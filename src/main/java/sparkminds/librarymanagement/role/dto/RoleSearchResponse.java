package sparkminds.librarymanagement.role.dto;

import java.util.List;

public record RoleSearchResponse(
        List<RoleSearchItemResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {
    public static RoleSearchResponse of(List<RoleSearchItemResponse> content, int page, int size, long totalElements) {
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        return new RoleSearchResponse(content, page, size, totalElements, totalPages,
                page == 0, (long) page + 1 >= totalPages);
    }
}
