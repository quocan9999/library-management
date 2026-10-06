package sparkminds.librarymanagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import sparkminds.librarymanagement.entity.EmailVerificationToken;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Integer> {
}
