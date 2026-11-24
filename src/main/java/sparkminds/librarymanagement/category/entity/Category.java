package sparkminds.librarymanagement.category.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Danh mục (category) phân loại sách, cấu trúc phẳng không phân cấp cha–con.
 * Quan hệ nhiều–nhiều với Book được khai báo và quản lý ở phía Book (owning side).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "categories")
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /** Tên danh mục, duy nhất không phân biệt hoa thường. */
    @Column(name = "name", nullable = false, unique = true, length = 100)
    private String name;

    /** Mô tả ngắn về danh mục, tùy chọn. */
    @Column(name = "description", length = 500)
    private String description;

    /** Khóa lạc quan (optimistic lock) cho cập nhật đồng thời từ nhiều Admin. */
    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
