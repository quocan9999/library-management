package sparkminds.librarymanagement.adminaccount.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountCreateRequest;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountPageResponse;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountResponse;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountRoleUpdateRequest;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountStatusUpdateRequest;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.BusinessException;

@Service
@RequiredArgsConstructor
public class AdminAccountService {
    private final AdminAccountReadService readService;
    private final AdminAccountMutationTransactionService transactionService;
    private final AccountRepository accountRepository;

    public AdminAccountPageResponse search(CustomUserPrincipal actor, String username, String email, String roleCode,
                                           Boolean enabled, Boolean emailVerified, Integer page, Integer size, String sort) {
        return readService.search(actor, username, email, roleCode, enabled, emailVerified, page, size, sort);
    }

    public AdminAccountResponse get(CustomUserPrincipal actor, Integer accountId) {
        return readService.get(actor, accountId);
    }

    public AdminAccountResponse create(CustomUserPrincipal actor, AdminAccountCreateRequest request) {
        try {
            return transactionService.create(actor, request);
        } catch (DataIntegrityViolationException exception) {
            if (accountRepository.existsByUsernameIgnoreCase(request.username())) throw duplicateUsername();
            if (accountRepository.existsByEmailIgnoreCase(request.email())) throw duplicateEmail();
            throw new BusinessException(HttpStatus.CONFLICT, "ADMIN_ACCOUNT_CONFLICT", "Tài khoản đã được thay đổi đồng thời");
        }
    }

    public AdminAccountResponse updateRole(CustomUserPrincipal actor, Integer accountId, AdminAccountRoleUpdateRequest request) {
        return transactionService.updateRole(actor, accountId, request);
    }

    public AdminAccountResponse updateStatus(CustomUserPrincipal actor, Integer accountId, AdminAccountStatusUpdateRequest request) {
        return transactionService.updateStatus(actor, accountId, request);
    }

    private static BusinessException duplicateUsername() {
        return new BusinessException(HttpStatus.CONFLICT, "ACCOUNT_USERNAME_DUPLICATED", "Tên đăng nhập đã được sử dụng");
    }
    private static BusinessException duplicateEmail() {
        return new BusinessException(HttpStatus.CONFLICT, "ACCOUNT_EMAIL_DUPLICATED", "Email đã được sử dụng");
    }
}
