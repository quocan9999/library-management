package sparkminds.librarymanagement.member.dto;

import java.time.LocalDate;

/** Hồ sơ tùy chọn dùng chung cho Register và Admin Create để tránh hai luồng tạo Member khác nhau. */
public record MemberRegistrationProfile(String fullName, LocalDate dateOfBirth, String phone, String address) {

    public static MemberRegistrationProfile empty() {
        return new MemberRegistrationProfile(null, null, null, null);
    }
}
