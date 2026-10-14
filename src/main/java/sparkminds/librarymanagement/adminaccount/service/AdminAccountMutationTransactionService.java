package sparkminds.librarymanagement.adminaccount.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountCreateRequest;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountResponse;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountRoleUpdateRequest;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountStatusUpdateRequest;
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
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminAccountMutationTransactionService {
    private static final String USER_ROLE = "USER";
    private static final String ADMIN_ROLE = "ADMIN";
    private static final String SUPER_ADMIN_ROLE = "SUPER_ADMIN";

    private final AccountRepository accountRepository;
    private final RoleRepositoy roleRepository;
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

        VerificationTokenService.IssuedToken issued = verificationTokenService.issue(account);
        verificationTokenRepository.saveAndFlush(issued.token());
        eventPublisher.publishEvent(new RegistrationMailRequested(account.getEmail(), issued.rawToken()));
        return response(account);
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
        refreshTokenRepository.revokeActiveByAccountId(target.getId(), nowUtc());
        return response(target);
    }

    private Map<Integer, Account> lockAccounts(Integer actorId, Integer targetId) {
        List<Integer> ids = java.util.stream.Stream.of(actorId, targetId)
                .filter(java.util.Objects::nonNull).distinct().sorted().toList();
        Map<Integer, Account> locked = new LinkedHashMap<>();
        accountRepository.findAllByIdInForUpdate(ids).stream()
                .sorted(Comparator.comparing(Account::getId))
                .forEach(account -> {
                    entityManager.refresh(account, LockModeType.PESSIMISTIC_WRITE);
                    locked.put(account.getId(), account);
                });
        if (locked.size() != ids.size()) {
            throw accountNotFound();
        }
        return locked;
    }

    private Map<String, Role> lockRoles(List<String> requestedCodes) {
        Map<String, Role> locked = new LinkedHashMap<>();
        requestedCodes.stream().distinct().sorted().forEach(code -> roleRepository.findByCodeForUpdate(code).ifPresent(role -> {
            entityManager.refresh(role, LockModeType.PESSIMISTIC_WRITE);
            locked.put(code, role);
        }));
        return locked;
    }

    private static void requireAdmin(Account actor) {
        if (actor == null || !actor.isEnabled() || !ADMIN_ROLE.equals(actor.getRole().getCode())) {
            throw new AccessDeniedException("Chỉ ADMIN mới được quản lý tài khoản quản trị");
        }
    }

    private static void ensureTarget(Account target) {
        if (target == null || USER_ROLE.equals(target.getRole().getCode())) throw accountNotFound();
    }

    private static void ensureNotSystem(Account target) {
        if (target.isSystemAccount()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "ACCOUNT_SYSTEM_PROTECTED", "Tài khoản quản trị hệ thống không thể bị thay đổi");
        }
    }

    private static void ensureNotSelf(CustomUserPrincipal actor, Account target, String code) {
        if (actor.getAccountId().equals(target.getId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, code, "Không thể thay đổi vai trò hoặc trạng thái của chính mình");
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

    private static AdminAccountResponse response(Account account) {
        return new AdminAccountResponse(account.getId(), account.getUsername(), account.getEmail(),
                account.getRole().getCode(), account.getRole().getDisplayName(), account.isEmailVerified(),
                account.isEnabled(), account.isSystemAccount(), account.getSessionVersion(), account.getCreatedAt());
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
