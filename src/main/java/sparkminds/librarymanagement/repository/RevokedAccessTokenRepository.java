package sparkminds.librarymanagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import sparkminds.librarymanagement.entity.RevokedAccessToken;

public interface RevokedAccessTokenRepository extends JpaRepository<RevokedAccessToken, Integer> {
}
