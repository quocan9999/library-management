package sparkminds.librarymanagement.loan.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import sparkminds.librarymanagement.common.api.BusinessException;

public final class BorrowPagination {

    private BorrowPagination() {
    }

    public static PageRequest parse(String page, String size, String sort, String allowedField, Sort.Direction defaultDirection) {
        try {
            int pageNumber = page == null ? 0 : Integer.parseInt(page);
            int pageSize = size == null ? 10 : Integer.parseInt(size);
            if (pageNumber < 0 || pageSize < 1 || pageSize > 10) throw new IllegalArgumentException();
            Sort.Direction direction = defaultDirection;
            if (sort != null && !sort.isBlank()) {
                String[] parts = sort.split(",", -1);
                if (parts.length != 2 || !parts[0].trim().equals(allowedField)) throw new IllegalArgumentException();
                direction = Sort.Direction.fromString(parts[1].trim());
            }
            return PageRequest.of(pageNumber, pageSize, Sort.by(direction, allowedField).and(Sort.by(direction, "id")));
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST_PARAMETER", "Tham số phân trang hoặc sắp xếp không hợp lệ");
        }
    }
}
