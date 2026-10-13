package sparkminds.librarymanagement.member.service;

import lombok.RequiredArgsConstructor;
import jakarta.persistence.OptimisticLockException;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.member.dto.MemberDetailResponse;
import sparkminds.librarymanagement.member.dto.MemberProfilePatchRequest;
import sparkminds.librarymanagement.member.entity.Member;
import sparkminds.librarymanagement.member.exception.MemberProfilePatchException;
import sparkminds.librarymanagement.member.repository.MemberRepository;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class MemberProfileService {

    private static final String PHONE_UNIQUE_CONSTRAINT = "uk_members_phone";

    private final MemberRepository memberRepository;
    private final MemberQueryService memberQueryService;

    /**
     * Cập nhật các field được gửi, kể cả khi giá trị là null; field vắng mặt được giữ nguyên.
     * So sánh version trước khi áp dụng giúp form cũ không ghi đè thay đổi mới hơn.
     */
    @Transactional
    public MemberDetailResponse patchProfile(Integer memberId, MemberProfilePatchRequest request) {
        if (memberId == null || memberId < 1) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_MEMBER_ID", "id thành viên không hợp lệ");
        }
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Không tìm thấy thành viên"));
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
                && memberRepository.existsByPhoneAndIdNot(phone, memberId)) {
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

        if (!changed) {
            return memberQueryService.getMember(memberId);
        }

        try {
            // Flush tại đây để ánh xạ tranh chấp @Version và unique index thành lỗi API ổn định.
            memberRepository.flush();
        } catch (ObjectOptimisticLockingFailureException | OptimisticLockException exception) {
            throw versionConflict();
        } catch (DataIntegrityViolationException exception) {
            if (isPhoneUniqueConstraint(exception)) {
                throw phoneConflict();
            }
            throw exception;
        }

        return memberQueryService.getMember(memberId);
    }

    static boolean isEligibleBirthDate(LocalDate birthDate, LocalDate today) {
        return MemberProfileRules.isEligibleBirthDate(birthDate, today);
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
