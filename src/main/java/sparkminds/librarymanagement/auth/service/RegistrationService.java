package sparkminds.librarymanagement.auth.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.dto.RegisterRequest;
import sparkminds.librarymanagement.auth.dto.RegisterResponse;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.common.api.BusinessException;

@Service
public class RegistrationService {

    private final AccountRepository accountRepository;
    private final RegistrationTransactionService registrationTransactionService;

    public RegistrationService(
            AccountRepository accountRepository,
            RegistrationTransactionService registrationTransactionService
    ) {
        this.accountRepository = accountRepository;
        this.registrationTransactionService = registrationTransactionService;
    }

    public RegisterResponse register(RegisterRequest request) {
        accountRepository.findByEmailIgnoreCase(request.email()).ifPresent(this::throwDuplicateEmail);
        try {
            registrationTransactionService.create(request);
        } catch (DataIntegrityViolationException exception) {
            // Bắt lỗi sau khi proxy transaction đã rollback, rồi phân loại theo tài khoản thắng cuộc.
            accountRepository.findByEmailIgnoreCase(request.email()).ifPresent(this::throwDuplicateEmail);
            throw exception;
        }
        return new RegisterResponse(request.email(), true);
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
