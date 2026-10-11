package sparkminds.librarymanagement.auth.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import sparkminds.librarymanagement.auth.entity.EmailVerificationToken;

import java.util.List;
import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Integer> {
    @EntityGraph(attributePaths = "account")
    Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

    @Query("select token.id as tokenId, account.id as accountId, account.email as email "
            + "from EmailVerificationToken token join token.account account where token.tokenHash = :tokenHash")
    Optional<VerificationTokenReference> findTokenReferenceByTokenHash(@Param("tokenHash") String tokenHash);

    List<EmailVerificationToken> findAllByAccountId(Integer accountId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select token from EmailVerificationToken token where token.id = :tokenId")
    Optional<EmailVerificationToken> findByIdForUpdate(@Param("tokenId") Integer tokenId);

    Optional<EmailVerificationToken> findFirstByAccountIdOrderByIdDesc(Integer accountId);

    interface VerificationTokenReference {
        Integer getTokenId();

        Integer getAccountId();

        String getEmail();
    }
}
