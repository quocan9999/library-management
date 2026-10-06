package sparkminds.librarymanagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import sparkminds.librarymanagement.entity.EmailChangeVerification;

public interface EmailChangeVerificationRepository extends JpaRepository<EmailChangeVerification, Integer> {
}
