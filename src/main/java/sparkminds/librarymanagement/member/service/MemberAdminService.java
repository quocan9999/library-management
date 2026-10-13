package sparkminds.librarymanagement.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.dto.RegisterRequest;
import sparkminds.librarymanagement.auth.service.RegistrationService;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.member.dto.CreateMemberRequest;
import sparkminds.librarymanagement.member.dto.MemberDetailResponse;
import sparkminds.librarymanagement.member.dto.MemberRegistrationProfile;
import sparkminds.librarymanagement.member.repository.MemberLoanHistoryRepository;
import sparkminds.librarymanagement.member.repository.MemberRepository;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class MemberAdminService {

    private final RegistrationService registrationService;
    private final MemberRepository memberRepository;
    private final MemberLoanHistoryRepository loanHistoryRepository;
    private final MemberDeletionTransactionService deletionTransactionService;
    private final MemberQueryService memberQueryService;

    public MemberDetailResponse create(CreateMemberRequest request) {
        String fullName = MemberProfileRules.normalizeOptionalText(request.fullName());
        String address = MemberProfileRules.normalizeOptionalText(request.address());
        LocalDate today = LocalDate.now();
        if (request.dateOfBirth() != null
                && !MemberProfileRules.isEligibleBirthDate(request.dateOfBirth(), today)) {
            throw invalidProfile("Ngày sinh phải hợp lệ và thành viên đủ 16 tuổi");
        }

        String phone;
        try {
            phone = MemberProfileRules.normalizePhone(request.phone());
        } catch (IllegalArgumentException exception) {
            throw invalidProfile(exception.getMessage());
        }
        if (phone != null && memberRepository.existsByPhone(phone)) {
            throw phoneConflict();
        }

        RegisterRequest credentials = new RegisterRequest(request.email(), request.password());
        MemberRegistrationProfile profile = new MemberRegistrationProfile(
                fullName, request.dateOfBirth(), phone, address);
        Integer memberId;
        try {
            memberId = registrationService.registerForAdmin(credentials, profile);
        } catch (DataIntegrityViolationException exception) {
            // Re-check after Register's transaction rolled back so a concurrent unique-phone winner is reported safely.
            if (phone != null && memberRepository.existsByPhone(phone)) {
                throw phoneConflict();
            }
            throw exception;
        }
        return memberQueryService.getMember(memberId);
    }

    public void delete(Integer memberId) {
        if (memberId == null || memberId < 1) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_MEMBER_ID", "id thành viên không hợp lệ");
        }
        try {
            deletionTransactionService.deleteMember(memberId);
        } catch (DataIntegrityViolationException exception) {
            // Đọc lại sau rollback để nhận diện race Loan-FK mà không nuốt các lỗi toàn vẹn khác.
            if (memberRepository.existsById(memberId) && loanHistoryRepository.existsForMember(memberId)) {
                throw MemberDeletionTransactionService.historyConflict();
            }
            throw exception;
        }
    }

    private static BusinessException invalidProfile(String message) {
        return new BusinessException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "MEMBER_CREATE_VALIDATION_ERROR",
                message
        );
    }

    private static BusinessException phoneConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "MEMBER_PHONE_DUPLICATED",
                "Số điện thoại đã được thành viên khác sử dụng"
        );
    }
}
