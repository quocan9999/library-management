package sparkminds.librarymanagement.auth.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import sparkminds.librarymanagement.auth.entity.PasswordResetToken;

import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Integer> {
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    @Query("""
            select token.id as tokenId, account.id as accountId, account.email as email
            from PasswordResetToken token join token.account account
            where token.tokenHash = :tokenHash
            """)
    Optional<TokenReference> findReferenceByTokenHash(@Param("tokenHash") String tokenHash);

    Optional<PasswordResetToken> findFirstByAccount_IdOrderByIdDesc(Integer accountId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select token from PasswordResetToken token where token.id = :tokenId")
    Optional<PasswordResetToken> findByIdForUpdate(@Param("tokenId") Integer tokenId);

    interface TokenReference {
        Integer getTokenId();

        Integer getAccountId();

        String getEmail();
    }
}
