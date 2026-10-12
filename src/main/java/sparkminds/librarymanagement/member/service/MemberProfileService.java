package sparkminds.librarymanagement.member.service;

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
public class MemberProfileService {

    private static final String PHONE_UNIQUE_CONSTRAINT = "uk_members_phone";

    private final MemberRepository memberRepository;
    private final MemberQueryService memberQueryService;

    public MemberProfileService(MemberRepository memberRepository, MemberQueryService memberQueryService) {
        this.memberRepository = memberRepository;
        this.memberQueryService = memberQueryService;
    }

    /**
     * Cập nhật một phần: trường thiếu/rỗng không xóa dữ liệu; version client phải khớp phiên bản đã đọc.
     * So sánh version trước khi áp dụng trường giúp form cũ không ghi đè thay đổi mới hơn.
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

        String fullName = MemberProfileRules.normalizeOptionalText(request.getFullName());
        if (fullName != null && fullName.length() > 150) {
            throw invalidField("fullName", "Họ và tên không được vượt quá 150 ký tự");
        }

        String address = MemberProfileRules.normalizeOptionalText(request.getAddress());
        if (address != null && address.length() > 255) {
            throw invalidField("address", "Địa chỉ không được vượt quá 255 ký tự");
        }

        LocalDate dateOfBirth = request.getDateOfBirth();
        if (dateOfBirth != null && !MemberProfileRules.isEligibleBirthDate(dateOfBirth, LocalDate.now())) {
            throw invalidField("dateOfBirth", "Ngày sinh phải hợp lệ và thành viên đủ 16 tuổi");
        }

        String phone;
        try {
            phone = MemberProfileRules.normalizePhone(request.getPhone());
        } catch (IllegalArgumentException exception) {
            throw invalidField("phone", exception.getMessage());
        }
        if (phone != null && !Objects.equals(phone, member.getPhone())
                && memberRepository.existsByPhoneAndIdNot(phone, memberId)) {
            throw phoneConflict();
        }

        boolean changed = false;
        if (fullName != null && !Objects.equals(fullName, member.getFullName())) {
            member.setFullName(fullName);
            changed = true;
        }
        if (dateOfBirth != null && !Objects.equals(dateOfBirth, member.getDateOfBirth())) {
            member.setDateOfBirth(dateOfBirth);
            changed = true;
        }
        if (phone != null && !Objects.equals(phone, member.getPhone())) {
            member.setPhone(phone);
            changed = true;
        }
        if (address != null && !Objects.equals(address, member.getAddress())) {
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
