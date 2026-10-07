package sparkminds.librarymanagement.config.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.config.entity.SystemConfig;

public interface SystemConfigRepository extends JpaRepository<SystemConfig, Byte> {
}
