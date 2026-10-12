package sparkminds.librarymanagement.member.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class MemberProfileServiceTests {

    @Test
    void dateOfBirthUsesTheSixteenthBirthdayIncludingLeapDayBoundary() {
        LocalDate leapBirthDate = LocalDate.of(2008, 2, 29);

        assertThat(MemberProfileService.isEligibleBirthDate(leapBirthDate, LocalDate.of(2024, 2, 28)))
                .isFalse();
        assertThat(MemberProfileService.isEligibleBirthDate(leapBirthDate, LocalDate.of(2024, 2, 29)))
                .isTrue();
        assertThat(MemberProfileService.isEligibleBirthDate(LocalDate.now().plusDays(1), LocalDate.now()))
                .isFalse();
    }
}
