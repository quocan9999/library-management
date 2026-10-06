package sparkminds.librarymanagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import sparkminds.librarymanagement.entity.Loan;

public interface LoanRepository extends JpaRepository<Loan, Integer> {
}
