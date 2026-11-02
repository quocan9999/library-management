package sparkminds.librarymanagement.adminaccount.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.OptimisticLockException;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountCreateRequest;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountResponse;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountRoleUpdateRequest;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountStatusUpdateRequest;
import sparkminds.librarymanagement.adminaccount.dto.StaffProfileResponse;
import sparkminds.librarymanagement.adminaccount.dto.StaffProfileUpdateRequest;
import sparkminds.librarymanagement.adminaccount.entity.Staff;
import sparkminds.librarymanagement.adminaccount.repository.StaffRepository;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.EmailVerificationTokenRepository;
import sparkminds.librarymanagement.auth.repository.RefreshTokenRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.auth.service.RegistrationMailRequested;
import sparkminds.librarymanagement.auth.service.VerificationTokenService;
import sparkminds.librarymanagement.common.api.BusinessException;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class AdminAccountMutationTransactionService {
    private static final String USER_ROLE = "USER";
    private static final String ADMIN_ROLE = "ADMIN";
    private static final String SUPER_ADMIN_ROLE = "SUPER_ADMIN";

    private final AccountRepository accountRepository;
    private final RoleRepositoy roleRepository;
    private final StaffRepository staffRepository;
    private final EmailVerificationTokenRepository verificationTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final VerificationTokenService verificationTokenService;
    private final ApplicationEventPublisher eventPublisher;
    private final EntityManager entityManager;
    private final Clock clock;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public AdminAccountResponse create(CustomUserPrincipal requestActor, AdminAccountCreateRequest request) {
        Account actor = lockAccounts(requestActor.getAccountId(), null).get(requestActor.getAccountId());
        requireAdmin(actor);
        Map<String, Role> roles = lockRoles(List.of(actor.getRole().getCode(), request.roleCode()));
        if (accountRepository.existsByUsernameIgnoreCase(request.username())) {
            throw duplicateUsername();
        }
        if (accountRepository.existsByEmailIgnoreCase(request.email())) {
            throw duplicateEmail();
        }
        Role targetRole = roles.get(request.roleCode());
        ensureAssignable(targetRole);

        if (!StaffProfileRules.isEligibleBirthDate(request.dateOfBirth(), LocalDate.now())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_STAFF_AGE", "Nhân viên phải từ 18 tuổi trở lên");
        }
        String normalizedPhone;
        try {
            normalizedPhone = StaffProfileRules.normalizePhone(request.phone());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_PHONE_FORMAT", ex.getMessage());
        }
        if (staffRepository.existsByPhone(normalizedPhone)) {
            throw new BusinessException(HttpStatus.CONFLICT, "PHONE_ALREADY_EXISTS", "Số điện thoại đã được sử dụng");
        }

        Account account = new Account();
        account.setUsername(request.username());
        account.setEmail(request.email());
        account.setPasswordHash(passwordEncoder.encode(request.password()));
        account.setRole(targetRole);
        account.setEmailVerified(false);
        account.setEnabled(true);
        account.setSystemAccount(false);
        account.setSessionVersion(0);
        account.setLastSessionChangeReason("OTHER");
        accountRepository.saveAndFlush(account);

        Staff staff = new Staff();
        staff.setAccount(account);
        staff.setStaffCode("NV" + String.format(Locale.ROOT, "%06d", account.getId()));
        staff.setFullName(request.fullName());
        staff.setDateOfBirth(request.dateOfBirth());
        staff.setPhone(normalizedPhone);
        staff.setAddress(StaffProfileRules.normalizeOptionalText(request.address()));
        staff.setVersion(0L);
        staffRepository.saveAndFlush(staff);

        VerificationTokenService.IssuedToken issued = verificationTokenService.issue(account);
        verificationTokenRepository.saveAndFlush(issued.token());
        eventPublisher.publishEvent(new RegistrationMailRequested(account.getEmail(), issued.rawToken()));
        return response(account, staff);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public StaffProfileResponse updateStaffProfile(
            CustomUserPrincipal requestActor,
            Integer targetAccountId,
            StaffProfileUpdateRequest request
    ) {
        Account actor = lockAccounts(requestActor.getAccountId(), null).get(requestActor.getAccountId());
        requireAdmin(actor);
        if (targetAccountId == null || targetAccountId <= 0) {
            throw accountNotFound();
        }
        Account target = accountRepository.findById(targetAccountId)
                .orElseThrow(AdminAccountMutationTransactionService::accountNotFound);
        if (USER_ROLE.equals(target.getRole().getCode())) {
            throw accountNotFound();
        }

        Staff staff = staffRepository.findByAccountId(target.getId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STAFF_NOT_FOUND", "Không tìm thấy hồ sơ nhân viên"));

        if (!Objects.equals(request.getVersion(), staff.getVersion())) {
            throw new BusinessException(HttpStatus.CONFLICT, "STAFF_VERSION_CONFLICT", "Hồ sơ đã được cập nhật bởi phiên làm việc khác");
        }

        // Validate all fields before mutating staff entity to prevent premature Hibernate auto-flush
        String newFullName = null;
        if (request.hasFullName()) {
            newFullName = StaffProfileRules.normalizeOptionalText(request.getFullName());
            if (newFullName == null || newFullName.isBlank()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_FULL_NAME", "Họ và tên không được để trống");
            }
            if (newFullName.length() > 150) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_FULL_NAME", "Họ và tên không được vượt quá 150 ký tự");
            }
        }

        LocalDate newDateOfBirth = null;
        if (request.hasDateOfBirth()) {
            newDateOfBirth = request.getDateOfBirth();
            if (newDateOfBirth == null || !StaffProfileRules.isEligibleBirthDate(newDateOfBirth, LocalDate.now())) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_STAFF_AGE", "Nhân viên phải từ 18 tuổi trở lên");
            }
        }

        String newPhone = null;
        if (request.hasPhone()) {
            String rawPhone = request.getPhone();
            if (rawPhone == null || rawPhone.isBlank()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_PHONE_FORMAT", "Số điện thoại không được để trống");
            }
            try {
                newPhone = StaffProfileRules.normalizePhone(rawPhone);
            } catch (IllegalArgumentException ex) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_PHONE_FORMAT", ex.getMessage());
            }
            if (!Objects.equals(newPhone, staff.getPhone())) {
                if (staffRepository.existsByPhoneAndIdNot(newPhone, staff.getId())) {
                    throw new BusinessException(HttpStatus.CONFLICT, "PHONE_ALREADY_EXISTS", "Số điện thoại đã được sử dụng");
                }
            }
        }

        String newAddress = null;
        if (request.hasAddress()) {
            newAddress = StaffProfileRules.normalizeOptionalText(request.getAddress());
            if (newAddress != null && newAddress.length() > 255) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_ADDRESS", "Địa chỉ không được vượt quá 255 ký tự");
            }
        }

        // Apply mutations
        boolean changed = false;
        if (request.hasFullName() && !Objects.equals(newFullName, staff.getFullName())) {
            staff.setFullName(newFullName);
            changed = true;
        }
        if (request.hasDateOfBirth() && !Objects.equals(newDateOfBirth, staff.getDateOfBirth())) {
            staff.setDateOfBirth(newDateOfBirth);
            changed = true;
        }
        if (request.hasPhone() && !Objects.equals(newPhone, staff.getPhone())) {
            staff.setPhone(newPhone);
            changed = true;
        }
        if (request.hasAddress() && !Objects.equals(newAddress, staff.getAddress())) {
            staff.setAddress(newAddress);
            changed = true;
        }

        if (changed) {
            try {
                staffRepository.flush();
            } catch (ObjectOptimisticLockingFailureException | OptimisticLockException exception) {
                throw new BusinessException(HttpStatus.CONFLICT, "STAFF_VERSION_CONFLICT", "Hồ sơ đã được cập nhật bởi phiên làm việc khác");
            } catch (DataIntegrityViolationException exception) {
                if (exception.getMessage() != null && exception.getMessage().contains("uk_staffs_phone")) {
                    throw new BusinessException(HttpStatus.CONFLICT, "PHONE_ALREADY_EXISTS", "Số điện thoại đã được sử dụng");
                }
                throw exception;
            }
        }

        return new StaffProfileResponse(
                staff.getId(),
                staff.getStaffCode(),
                staff.getFullName(),
                staff.getDateOfBirth(),
                staff.getPhone(),
                staff.getAddress(),
                staff.getVersion(),
                staff.getCreatedAt(),
                staff.getUpdatedAt()
        );
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public AdminAccountResponse updateRole(
            CustomUserPrincipal requestActor,
            Integer accountId,
            AdminAccountRoleUpdateRequest request
    ) {
        Map<Integer, Account> accounts = lockAccounts(requestActor.getAccountId(), accountId);
        Account actor = accounts.get(requestActor.getAccountId());
        Account target = accounts.get(accountId);
        requireAdmin(actor);
        ensureTarget(target);
        ensureNotSystem(target);
        ensureNotSelf(requestActor, target, "ACCOUNT_SELF_ROLE_CHANGE_FORBIDDEN");

        String sourceCode = target.getRole().getCode();
        Map<String, Role> roles = lockRoles(List.of(actor.getRole().getCode(), sourceCode, request.roleCode()));
        requireAdmin(actor);
        Role sourceRole = roles.get(sourceCode);
        Role destinationRole = roles.get(request.roleCode());
        if (sourceRole == null || destinationRole == null || USER_ROLE.equals(sourceCode)
                || !sourceRole.isEnabled() || destinationRole.getCode().equals(USER_ROLE)
                || destinationRole.getCode().equals(SUPER_ADMIN_ROLE) || !destinationRole.isEnabled()) {
            throw assignmentForbidden();
        }
        if (target.getRole().getCode().equals(destinationRole.getCode())) {
            throw new BusinessException(HttpStatus.CONFLICT, "ACCOUNT_ROLE_UNCHANGED", "Tài khoản đã thuộc nhóm quyền này");
        }
        ensureSessionVersion(target, request.expectedSessionVersion());

        target.setRole(destinationRole);
        target.setSessionVersion(target.getSessionVersion() + 1);
        target.setLastSessionChangeReason("ROLE_CHANGED");
        accountRepository.flush();
        refreshTokenRepository.revokeActiveByAccountId(target.getId(), nowUtc());
        return response(target);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public AdminAccountResponse updateStatus(
            CustomUserPrincipal requestActor,
            Integer accountId,
            AdminAccountStatusUpdateRequest request
    ) {
        Map<Integer, Account> accounts = lockAccounts(requestActor.getAccountId(), accountId);
        Account actor = accounts.get(requestActor.getAccountId());
        Account target = accounts.get(accountId);
        requireAdmin(actor);
        ensureTarget(target);
        ensureNotSystem(target);
        ensureNotSelf(requestActor, target, "ACCOUNT_SELF_DISABLE_FORBIDDEN");
        if (USER_ROLE.equals(target.getRole().getCode())) throw accountNotFound();
        Map<String, Role> roles = lockRoles(List.of(actor.getRole().getCode(), target.getRole().getCode()));
        requireAdmin(actor);
        if (roles.get(target.getRole().getCode()) == null) throw assignmentForbidden();
        ensureSessionVersion(target, request.expectedSessionVersion());

        if (target.isEnabled() == request.enabled()) {
            throw new BusinessException(HttpStatus.CONFLICT, "ACCOUNT_STATUS_UNCHANGED", "Trạng thái tài khoản không thay đổi");
        }
        target.setEnabled(request.enabled());
        target.setSessionVersion(target.getSessionVersion() + 1);
        target.setLastSessionChangeReason(request.enabled() ? "ACCOUNT_ENABLED" : "ACCOUNT_DISABLED");
        accountRepository.flush();
        if (!request.enabled()) {
            refreshTokenRepository.revokeActiveByAccountId(target.getId(), nowUtc());
        }
        return response(target);
    }

    private Map<Integer, Account> lockAccounts(Integer firstId, Integer secondId) {
        List<Integer> ids = secondId == null ? List.of(firstId)
                : (firstId < secondId ? List.of(firstId, secondId) : List.of(secondId, firstId));
        Map<Integer, Account> result = new LinkedHashMap<>();
        for (Integer id : ids) {
            Account account = entityManager.find(Account.class, id, LockModeType.PESSIMISTIC_WRITE);
            if (account != null) result.put(id, account);
        }
        return result;
    }

    private Map<String, Role> lockRoles(List<String> roleCodes) {
        List<String> sorted = roleCodes.stream().filter(Objects::nonNull).distinct().sorted(Comparator.naturalOrder()).toList();
        Map<String, Role> result = new LinkedHashMap<>();
        for (String code : sorted) {
            roleRepository.findByCodeForUpdate(code).ifPresent(role -> result.put(code, role));
        }
        return result;
    }

    private static void requireAdmin(Account actor) {
        if (actor == null || !actor.isEnabled() || !ADMIN_ROLE.equals(actor.getRole().getCode())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Phiên quản trị không còn hợp lệ");
        }
    }

    private static void ensureTarget(Account target) {
        if (target == null) throw accountNotFound();
    }

    private static void ensureNotSystem(Account target) {
        if (target.isSystemAccount()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "ACCOUNT_SYSTEM_PROTECTED", "Không thể chỉnh sửa tài khoản hệ thống");
        }
    }

    private static void ensureNotSelf(CustomUserPrincipal actor, Account target, String code) {
        if (Objects.equals(actor.getAccountId(), target.getId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, code, "Không thể thao tác trên tài khoản của chính mình");
        }
    }

    private static void ensureAssignable(Role role) {
        if (role == null) throw new BusinessException(HttpStatus.NOT_FOUND, "ROLE_NOT_FOUND", "Không tìm thấy nhóm quyền");
        if (!role.isEnabled() || USER_ROLE.equals(role.getCode()) || SUPER_ADMIN_ROLE.equals(role.getCode())) {
            throw assignmentForbidden();
        }
    }

    private static void ensureSessionVersion(Account account, long expected) {
        if (account.getSessionVersion() != expected) {
            throw new BusinessException(HttpStatus.CONFLICT, "ACCOUNT_SESSION_CONFLICT", "Tài khoản đã thay đổi. Hãy tải lại dữ liệu.");
        }
    }

    private AdminAccountResponse response(Account account) {
        Staff staff = staffRepository.findByAccountId(account.getId()).orElse(null);
        return response(account, staff);
    }

    private static AdminAccountResponse response(Account account, Staff staff) {
        StaffProfileResponse staffResponse = staff == null ? null : new StaffProfileResponse(
                staff.getId(),
                staff.getStaffCode(),
                staff.getFullName(),
                staff.getDateOfBirth(),
                staff.getPhone(),
                staff.getAddress(),
                staff.getVersion(),
                staff.getCreatedAt(),
                staff.getUpdatedAt()
        );
        return new AdminAccountResponse(
                account.getId(),
                account.getUsername(),
                account.getEmail(),
                account.getRole().getCode(),
                account.getRole().getDisplayName(),
                account.isEmailVerified(),
                account.isEnabled(),
                account.isSystemAccount(),
                account.getSessionVersion(),
                account.getCreatedAt(),
                staffResponse
        );
    }

    private LocalDateTime nowUtc() { return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC); }

    private static BusinessException assignmentForbidden() {
        return new BusinessException(HttpStatus.FORBIDDEN, "ROLE_ASSIGNMENT_FORBIDDEN", "Không thể gán tài khoản vào nhóm quyền này");
    }
    private static BusinessException duplicateUsername() {
        return new BusinessException(HttpStatus.CONFLICT, "ACCOUNT_USERNAME_DUPLICATED", "Tên đăng nhập đã được sử dụng");
    }
    private static BusinessException duplicateEmail() {
        return new BusinessException(HttpStatus.CONFLICT, "ACCOUNT_EMAIL_DUPLICATED", "Email đã được sử dụng");
    }
    private static BusinessException accountNotFound() {
        return new BusinessException(HttpStatus.NOT_FOUND, "ADMIN_ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản quản trị");
    }
}
