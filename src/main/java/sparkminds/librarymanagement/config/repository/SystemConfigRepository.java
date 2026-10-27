package sparkminds.librarymanagement.config.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import sparkminds.librarymanagement.config.entity.SystemConfig;

import java.util.Optional;

/**
 * Repository truy xuất cấu hình hệ thống.
 */
public interface SystemConfigRepository extends JpaRepository<SystemConfig, Byte> {

    /**
     * Nạp cấu hình hệ thống cùng thông tin chi tiết và danh sách vai trò miễn trừ để tránh N+1 query.
     */
    @Query("SELECT c FROM SystemConfig c " +
           "LEFT JOIN FETCH c.maintenanceDetail " +
           "LEFT JOIN FETCH c.bypassRoles " +
           "WHERE c.id = :id")
    Optional<SystemConfig> findByIdWithDetails(@Param("id") Byte id);
}
