package sparkminds.librarymanagement.config.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import sparkminds.librarymanagement.config.entity.SystemConfigHistory;

/**
 * Repository truy xuất lịch sử thay đổi cấu hình hệ thống.
 */
public interface SystemConfigHistoryRepository extends JpaRepository<SystemConfigHistory, Long> {

    /**
     * Lấy danh sách lịch sử sắp xếp mới nhất, kèm thông tin tài khoản thao tác.
     */
    @Query("SELECT h FROM SystemConfigHistory h LEFT JOIN FETCH h.account WHERE h.systemConfig.id = :configId ORDER BY h.createdAt DESC")
    Page<SystemConfigHistory> findBySystemConfigIdOrderByCreatedAtDesc(@Param("configId") Byte configId, Pageable pageable);
}
