package sparkminds.librarymanagement.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.auth.entity.PasswordResetToken;

import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Integer> {
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);
}
