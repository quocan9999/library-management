package sparkminds.librarymanagement.dto.response;

import java.util.List;

public record AuthenticatedAccountResponse(String identifier, List<String> authorities) {
}
