package sparkminds.librarymanagement.auth.validation;

public final class PasswordPolicy {

    public static final String REGEX = "(?U)^(?=.{8,20}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)"
            + "(?=.*[\\p{P}\\p{S}])\\S+$";

    private PasswordPolicy() {
    }
}
