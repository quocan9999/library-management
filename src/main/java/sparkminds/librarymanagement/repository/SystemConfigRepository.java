package sparkminds.librarymanagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import sparkminds.librarymanagement.entity.SystemConfig;

public interface SystemConfigRepository extends JpaRepository<SystemConfig, Byte> {
}
