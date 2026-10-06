package sparkminds.librarymanagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import sparkminds.librarymanagement.entity.LoanItem;

public interface LoanItemRepository extends JpaRepository<LoanItem, Integer> {
}
