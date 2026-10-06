package sparkminds.librarymanagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import sparkminds.librarymanagement.entity.Member;

public interface MemberRepository extends JpaRepository<Member, Integer> {
}
