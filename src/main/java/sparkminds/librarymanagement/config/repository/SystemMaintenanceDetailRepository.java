package sparkminds.librarymanagement.config.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.config.entity.SystemMaintenanceDetail;

import java.util.Optional;

/**
 * Repository thao tác với thông tin chi tiết bảo trì hệ thống.
 */
public interface SystemMaintenanceDetailRepository extends JpaRepository<SystemMaintenanceDetail, Long> {

    Optional<SystemMaintenanceDetail> findBySystemConfigId(Byte systemConfigId);
}
