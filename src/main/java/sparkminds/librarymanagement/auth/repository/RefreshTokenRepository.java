package sparkminds.librarymanagement.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import sparkminds.librarymanagement.auth.entity.RefreshToken;

import java.util.Optional;
import java.time.LocalDateTime;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Integer> {
    Optional<RefreshToken> findByJti(String jti);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select token from RefreshToken token join fetch token.account where token.jti = :jti")
    Optional<RefreshToken> findByJtiForUpdate(@Param("jti") String jti);

    @Modifying(flushAutomatically = true)
    @Query("""
            update RefreshToken token set token.revokedAt = :revokedAt
            where token.account.id = :accountId and token.revokedAt is null and token.expiresAt > :revokedAt
            """)
    int revokeActiveByAccountId(
            @Param("accountId") Integer accountId,
            @Param("revokedAt") LocalDateTime revokedAt
    );
}
