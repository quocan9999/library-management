package sparkminds.librarymanagement.adminaccount.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import sparkminds.librarymanagement.adminaccount.entity.Staff;

import java.util.Optional;

@Repository
public interface StaffRepository extends JpaRepository<Staff, Integer> {
    Optional<Staff> findByAccountId(Integer accountId);

    Optional<Staff> findByStaffCode(String staffCode);

    boolean existsByPhone(String phone);

    boolean existsByPhoneAndIdNot(String phone, Integer id);

    boolean existsByStaffCode(String staffCode);
}
