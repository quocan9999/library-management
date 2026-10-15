package sparkminds.librarymanagement.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import sparkminds.librarymanagement.auth.entity.Account;

import java.util.Optional;
import java.time.LocalDateTime;

public interface AccountRepository extends JpaRepository<Account, Integer> {
    @EntityGraph(attributePaths = {"role", "role.permissions"})
    Optional<Account> findByUsernameOrEmail(String username, String email);

    Optional<Account> findByUsername(String username);

    Optional<Account> findByEmail(String email);

    Optional<Account> findByEmailIgnoreCase(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select account from Account account where account.id = :accountId")
    Optional<Account> findByIdForUpdate(@Param("accountId") Integer accountId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update Account account
            set account.enabled = :enabled, account.sessionVersion = account.sessionVersion + 1,
                account.lastSessionChangeReason = :reason, account.updatedAt = :updatedAt
            where account.id = :accountId and account.enabled = :expectedEnabled
            """)
    int updateStatusAndAdvanceSessionVersion(
            @Param("accountId") Integer accountId,
            @Param("expectedEnabled") boolean expectedEnabled,
            @Param("enabled") boolean enabled,
            @Param("reason") String reason,
            @Param("updatedAt") LocalDateTime updatedAt
    );

    @Query("select account from Account account where account.id in :accountIds order by account.id")
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    java.util.List<Account> findAllByIdInForUpdate(@Param("accountIds") java.util.Collection<Integer> accountIds);

    @Query("select role.code from Account account join account.role role where account.id = :accountId")
    Optional<String> findRoleCodeByAccountId(@Param("accountId") Integer accountId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select account from Account account where lower(account.email) = lower(:email)")
    Optional<Account> findByEmailForUpdate(@Param("email") String email);

    boolean existsByUsername(String username);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);
}
