package sparkminds.librarymanagement.member.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.member.entity.Member;
import sparkminds.librarymanagement.member.repository.MemberLoanHistoryRepository;
import sparkminds.librarymanagement.member.repository.MemberRepository;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MemberDeletionTransactionServiceTests {

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private MemberLoanHistoryRepository loanHistoryRepository;

    @InjectMocks
    private MemberDeletionTransactionService service;

    @Test
    void refusesToDeleteAnAdminAccountEvenIfItHasAMemberRow() {
        Account account = new Account();
        Role role = new Role();
        role.setCode("ROLE_ADMIN");
        account.setRole(role);
        Member member = new Member();
        member.setAccount(account);
        when(memberRepository.findById(17)).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> service.deleteMember(17))
                .isInstanceOfSatisfying(sparkminds.librarymanagement.common.api.BusinessException.class,
                        exception -> org.assertj.core.api.Assertions.assertThat(exception.getCode())
                                .isEqualTo("MEMBER_NOT_FOUND"));
        verify(loanHistoryRepository, never()).existsForMember(17);
        verify(memberRepository, never()).delete(member);
        verify(accountRepository, never()).delete(account);
    }
}
