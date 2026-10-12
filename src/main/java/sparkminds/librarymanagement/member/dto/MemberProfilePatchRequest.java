package sparkminds.librarymanagement.member.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDate;

/** Chỉ cho phép client gửi version và bốn trường hồ sơ được chỉnh sửa. */
public final class MemberProfilePatchRequest {

    @NotNull(message = "version là bắt buộc")
    @PositiveOrZero(message = "version không được âm")
    private Long version;
    private String fullName;
    private LocalDate dateOfBirth;
    private String phone;
    private String address;

    /** Tách sự hiện diện khỏi giá trị null để giữ được ngữ nghĩa PATCH cho từng field. */
    private boolean fullNamePresent;
    private boolean dateOfBirthPresent;
    private boolean phonePresent;
    private boolean addressPresent;

    public MemberProfilePatchRequest() {
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullNamePresent = true;
        this.fullName = fullName;
    }

    public boolean hasFullName() {
        return fullNamePresent;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirthPresent = true;
        this.dateOfBirth = dateOfBirth;
    }

    public boolean hasDateOfBirth() {
        return dateOfBirthPresent;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phonePresent = true;
        this.phone = phone;
    }

    public boolean hasPhone() {
        return phonePresent;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.addressPresent = true;
        this.address = address;
    }

    public boolean hasAddress() {
        return addressPresent;
    }

    /** Từ chối trường ngoài whitelist để JSON không âm thầm bỏ qua ý định mass assignment. */
    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object ignoredValue) {
        throw new IllegalArgumentException("Unsupported member profile field.");
    }
}
