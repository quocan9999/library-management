package sparkminds.librarymanagement.adminaccount.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDate;

public final class StaffProfileUpdateRequest {

    @NotNull(message = "version là bắt buộc")
    @PositiveOrZero(message = "version không được âm")
    private Long version;
    private String fullName;
    private LocalDate dateOfBirth;
    private String phone;
    private String address;

    private boolean fullNamePresent;
    private boolean dateOfBirthPresent;
    private boolean phonePresent;
    private boolean addressPresent;

    public StaffProfileUpdateRequest() {
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

    @JsonAnySetter
    public void rejectUnknownProperty(String name, Object value) {
        throw new IllegalArgumentException("Không hỗ trợ cập nhật trường: " + name);
    }
}
