package sparkminds.librarymanagement.adminaccount.service;

import java.time.LocalDate;
import java.util.regex.Pattern;

public final class StaffProfileRules {

    private static final Pattern VIETNAM_MOBILE = Pattern.compile("^0[35789][0-9]{8}$");
    private static final Pattern PHONE_FORMAT = Pattern.compile("^[0-9.\\s-]+$");

    private StaffProfileRules() {
    }

    public static String normalizeOptionalText(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static String normalizePhone(String value) {
        String text = normalizeOptionalText(value);
        if (text == null) return null;
        if (!PHONE_FORMAT.matcher(text).matches()) {
            throw new IllegalArgumentException(
                    "Số điện thoại chỉ được chứa chữ số, dấu chấm, gạch ngang hoặc khoảng trắng");
        }
        String digits = text.replaceAll("[.\\s-]", "");
        if (!VIETNAM_MOBILE.matcher(digits).matches()) {
            throw new IllegalArgumentException(
                    "Số điện thoại phải có 10 chữ số và đầu số di động Việt Nam hợp lệ");
        }
        return digits;
    }

    public static boolean isEligibleBirthDate(LocalDate birthDate, LocalDate today) {
        return birthDate != null && !birthDate.isAfter(today) && !birthDate.plusYears(18).isAfter(today);
    }
}
