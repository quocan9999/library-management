package sparkminds.librarymanagement.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.auth.entity.EmailVerificationToken;

import java.util.Optional;
import java.util.List;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Integer> {
    Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

    List<EmailVerificationToken> findAllByAccountId(Integer accountId);
}
