package sparkminds.librarymanagement.adminaccount.dto;

import java.util.List;

public record AdminAccountPageResponse(
        List<AdminAccountResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {
    public static AdminAccountPageResponse of(List<AdminAccountResponse> content, int page, int size, long total) {
        int pages = total == 0 ? 0 : (int) Math.ceil((double) total / size);
        return new AdminAccountPageResponse(content, page, size, total, pages, page == 0, page + 1 >= pages);
    }
}
