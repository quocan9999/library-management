package sparkminds.librarymanagement.profile.service;

import jakarta.persistence.OptimisticLockException;
import lombok.RequiredArgsConstructor;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.member.dto.MemberProfilePatchRequest;
import sparkminds.librarymanagement.member.entity.Member;
import sparkminds.librarymanagement.member.exception.MemberProfilePatchException;
import sparkminds.librarymanagement.member.repository.MemberRepository;
import sparkminds.librarymanagement.member.service.MemberProfileRules;
import sparkminds.librarymanagement.profile.dto.UserProfileResponse;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private static final String PHONE_UNIQUE_CONSTRAINT = "uk_members_phone";

    private final AccountRepository accountRepository;
    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(CustomUserPrincipal principal) {
        Account account = accountRepository.findById(principal.getAccountId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản"));

        Optional<Member> memberOptional = memberRepository.findByAccountId(account.getId());
        if (memberOptional.isPresent()) {
            Member member = memberOptional.get();
            return new UserProfileResponse(
                    account.getId(),
                    account.getUsername(),
                    account.getEmail(),
                    account.getRole().getCode(),
                    member.getId(),
                    member.getMemberCode(),
                    member.getFullName(),
                    member.getDateOfBirth(),
                    member.getPhone(),
                    member.getAddress(),
                    member.getVersion()
            );
        }

        return new UserProfileResponse(
                account.getId(),
                account.getUsername(),
                account.getEmail(),
                account.getRole().getCode(),
                null,
                null,
                null,
                null,
                null,
                null,
                0L
        );
    }

    @Transactional
    public UserProfileResponse patchProfile(CustomUserPrincipal principal, MemberProfilePatchRequest request) {
        Account account = accountRepository.findById(principal.getAccountId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản"));

        Member member = memberRepository.findByAccountId(account.getId())
                .orElseGet(() -> {
                    Member newMember = new Member();
                    newMember.setAccount(account);
                    newMember.setMemberCode("A" + String.format(Locale.ROOT, "%06d", account.getId()));
                    newMember.setVersion(0L);
                    return memberRepository.saveAndFlush(newMember);
                });

        if (!Objects.equals(request.getVersion(), member.getVersion())) {
            throw versionConflict();
        }

        boolean fullNamePresent = request.hasFullName();
        String fullName = fullNamePresent
                ? MemberProfileRules.normalizeOptionalText(request.getFullName()) : null;
        if (fullNamePresent && fullName != null && fullName.length() > 150) {
            throw invalidField("fullName", "Họ và tên không được vượt quá 150 ký tự");
        }

        boolean addressPresent = request.hasAddress();
        String address = addressPresent
                ? MemberProfileRules.normalizeOptionalText(request.getAddress()) : null;
        if (addressPresent && address != null && address.length() > 255) {
            throw invalidField("address", "Địa chỉ không được vượt quá 255 ký tự");
        }

        boolean dateOfBirthPresent = request.hasDateOfBirth();
        LocalDate dateOfBirth = request.getDateOfBirth();
        if (dateOfBirthPresent && dateOfBirth != null
                && !MemberProfileRules.isEligibleBirthDate(dateOfBirth, LocalDate.now())) {
            throw invalidField("dateOfBirth", "Ngày sinh phải hợp lệ và thành viên đủ 16 tuổi");
        }

        boolean phonePresent = request.hasPhone();
        String phone;
        try {
            phone = phonePresent ? MemberProfileRules.normalizePhone(request.getPhone()) : null;
        } catch (IllegalArgumentException exception) {
            throw invalidField("phone", exception.getMessage());
        }
        if (phonePresent && phone != null && !Objects.equals(phone, member.getPhone())
                && memberRepository.existsByPhoneAndIdNot(phone, member.getId())) {
            throw phoneConflict();
        }

        boolean changed = false;
        if (fullNamePresent && !Objects.equals(fullName, member.getFullName())) {
            member.setFullName(fullName);
            changed = true;
        }
        if (dateOfBirthPresent && !Objects.equals(dateOfBirth, member.getDateOfBirth())) {
            member.setDateOfBirth(dateOfBirth);
            changed = true;
        }
        if (phonePresent && !Objects.equals(phone, member.getPhone())) {
            member.setPhone(phone);
            changed = true;
        }
        if (addressPresent && !Objects.equals(address, member.getAddress())) {
            member.setAddress(address);
            changed = true;
        }

        if (changed) {
            try {
                memberRepository.flush();
            } catch (ObjectOptimisticLockingFailureException | OptimisticLockException exception) {
                throw versionConflict();
            } catch (DataIntegrityViolationException exception) {
                if (isPhoneUniqueConstraint(exception)) {
                    throw phoneConflict();
                }
                throw exception;
            }
        }

        return new UserProfileResponse(
                account.getId(),
                account.getUsername(),
                account.getEmail(),
                account.getRole().getCode(),
                member.getId(),
                member.getMemberCode(),
                member.getFullName(),
                member.getDateOfBirth(),
                member.getPhone(),
                member.getAddress(),
                member.getVersion()
        );
    }

    private static boolean isPhoneUniqueConstraint(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation
                    && PHONE_UNIQUE_CONSTRAINT.equalsIgnoreCase(violation.getConstraintName())) {
                return true;
            }
            if (cause instanceof SQLException sqlException
                    && sqlException.getErrorCode() == 1062
                    && sqlException.getMessage() != null
                    && sqlException.getMessage().contains(PHONE_UNIQUE_CONSTRAINT)) {
                return true;
            }
        }
        return false;
    }

    private static MemberProfilePatchException invalidField(String field, String message) {
        return new MemberProfilePatchException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "MEMBER_PATCH_VALIDATION_ERROR",
                "Dữ liệu hồ sơ thành viên không hợp lệ",
                Map.of(field, message)
        );
    }

    private static MemberProfilePatchException phoneConflict() {
        return new MemberProfilePatchException(
                HttpStatus.CONFLICT,
                "MEMBER_PHONE_DUPLICATED",
                "Số điện thoại đã được thành viên khác sử dụng",
                Map.of("phone", "Số điện thoại đã được sử dụng")
        );
    }

    private static BusinessException versionConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "MEMBER_VERSION_CONFLICT",
                "Thông tin thành viên đã được thay đổi bởi quản trị viên khác"
        );
    }
}
