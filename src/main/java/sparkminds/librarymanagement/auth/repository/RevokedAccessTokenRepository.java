package sparkminds.librarymanagement.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.auth.entity.RevokedAccessToken;


public interface RevokedAccessTokenRepository extends JpaRepository<RevokedAccessToken, Integer> {
    boolean existsByJti(String jti);
}
