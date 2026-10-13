package sparkminds.librarymanagement.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.dto.RegisterRequest;
import sparkminds.librarymanagement.auth.dto.RegisterResponse;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.member.dto.MemberRegistrationProfile;

@Service
@RequiredArgsConstructor
public class RegistrationService {

    private final AccountRepository accountRepository;
    private final RegistrationTransactionService registrationTransactionService;

    public RegisterResponse register(RegisterRequest request) {
        registerForAdmin(request, MemberRegistrationProfile.empty());
        return new RegisterResponse(request.email(), true);
    }

    /** Dùng chung transaction Register để tài khoản tạo bởi quản trị viên có cùng vòng đời xác thực. */
    public Integer registerForAdmin(RegisterRequest request, MemberRegistrationProfile profile) {
        accountRepository.findByEmailIgnoreCase(request.email()).ifPresent(this::throwDuplicateEmail);
        try {
            return registrationTransactionService.create(request, profile);
        } catch (DataIntegrityViolationException exception) {
            // Bắt lỗi sau khi proxy transaction đã rollback, rồi phân loại theo tài khoản thắng cuộc.
            accountRepository.findByEmailIgnoreCase(request.email()).ifPresent(this::throwDuplicateEmail);
            throw exception;
        }
    }

    private void throwDuplicateEmail(Account account) {
        if (account.isEmailVerified()) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "EMAIL_ALREADY_REGISTERED",
                    "Email này đã được đăng ký. Vui lòng đăng nhập."
            );
        }
        throw new BusinessException(
                HttpStatus.CONFLICT,
                "EMAIL_NOT_VERIFIED_REGISTERED",
                "Email này đã đăng ký nhưng chưa được xác thực. "
                        + "Vui lòng yêu cầu gửi lại email xác thực."
        );
    }
}
