package sparkminds.librarymanagement.role.policy;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * Khai báo tập trung các quyền cơ sở bắt buộc theo nghiệp vụ; không suy diễn dependency từ tên quyền.
 */
@Component
public class PermissionDependencyRegistry {

    private final Map<String, Set<String>> dependenciesByPermission;

    public PermissionDependencyRegistry() {
        this(defaultDependencies());
    }

    PermissionDependencyRegistry(Map<String, ? extends Collection<String>> dependencies) {
        this.dependenciesByPermission = validateAndCopy(dependencies);
        validateAcyclic();
    }

    public Set<String> directDependencies(String permissionCode) {
        return dependenciesByPermission.getOrDefault(permissionCode, Set.of());
    }

    /** Trả về mọi dependency trực tiếp và bắc cầu cần có khi cấp các quyền đầu vào. */
    public Set<String> requiredPermissionsFor(Collection<String> permissionCodes) {
        Set<String> required = new TreeSet<>();
        for (String permissionCode : permissionCodes) {
            collectDependencies(permissionCode, required);
        }
        return Collections.unmodifiableSet(new LinkedHashSet<>(required));
    }

    /** Tìm dependency còn thiếu trong tập quyền cuối cùng trước khi Role được ghi. */
    public Map<String, Set<String>> missingDependencies(Collection<String> assignedPermissions) {
        Set<String> assigned = Set.copyOf(assignedPermissions);
        Map<String, Set<String>> missing = new TreeMap<>();
        for (String permissionCode : assigned) {
            Set<String> absent = new TreeSet<>(directDependencies(permissionCode));
            absent.removeAll(assigned);
            if (!absent.isEmpty()) {
                missing.put(permissionCode, Collections.unmodifiableSet(absent));
            }
        }
        return Collections.unmodifiableMap(new LinkedHashMap<>(missing));
    }

    /** Dừng an toàn nếu registry lệch khỏi danh mục quyền đã áp dụng bằng Liquibase. */
    public void validateCatalog(Collection<String> catalogCodes) {
        Set<String> catalog = Set.copyOf(catalogCodes);
        Set<String> missing = new TreeSet<>();
        dependenciesByPermission.forEach((permission, required) -> {
            if (!catalog.contains(permission)) {
                missing.add(permission);
            }
            required.stream().filter(code -> !catalog.contains(code)).forEach(missing::add);
        });
        if (!missing.isEmpty()) {
            throw new IllegalStateException("Permission dependency registry references unknown catalog codes: " + missing);
        }
    }

    private void collectDependencies(String permissionCode, Set<String> required) {
        for (String dependency : directDependencies(permissionCode)) {
            if (required.add(dependency)) {
                collectDependencies(dependency, required);
            }
        }
    }

    private void validateAcyclic() {
        Set<String> complete = new LinkedHashSet<>();
        Set<String> visiting = new LinkedHashSet<>();
        for (String permissionCode : dependenciesByPermission.keySet()) {
            visit(permissionCode, visiting, complete);
        }
    }

    private void visit(String permissionCode, Set<String> visiting, Set<String> complete) {
        if (complete.contains(permissionCode)) {
            return;
        }
        if (!visiting.add(permissionCode)) {
            List<String> cycle = new ArrayList<>(visiting);
            cycle.add(permissionCode);
            throw new IllegalArgumentException("Permission dependency cycle: " + String.join(" -> ", cycle));
        }
        for (String dependency : directDependencies(permissionCode)) {
            visit(dependency, visiting, complete);
        }
        visiting.remove(permissionCode);
        complete.add(permissionCode);
    }

    private static Map<String, Set<String>> validateAndCopy(
            Map<String, ? extends Collection<String>> dependencies
    ) {
        if (dependencies == null) {
            throw new IllegalArgumentException("Permission dependencies are required");
        }
        Map<String, Set<String>> validated = new TreeMap<>();
        dependencies.forEach((permissionCode, requiredPermissions) -> {
            requirePermissionCode(permissionCode);
            if (requiredPermissions == null) {
                throw new IllegalArgumentException("Permission dependency list cannot be null: " + permissionCode);
            }
            Set<String> required = new TreeSet<>();
            for (String dependency : requiredPermissions) {
                requirePermissionCode(dependency);
                if (permissionCode.equals(dependency)) {
                    throw new IllegalArgumentException("Permission cannot depend on itself: " + permissionCode);
                }
                if (!required.add(dependency)) {
                    throw new IllegalArgumentException("Duplicate dependency " + dependency + " for " + permissionCode);
                }
            }
            validated.put(permissionCode, Collections.unmodifiableSet(new LinkedHashSet<>(required)));
        });
        return Collections.unmodifiableMap(new LinkedHashMap<>(validated));
    }

    private static void requirePermissionCode(String permissionCode) {
        if (permissionCode == null || permissionCode.isBlank() || permissionCode.chars().anyMatch(Character::isWhitespace)) {
            throw new IllegalArgumentException("Permission code must be non-blank and contain no whitespace");
        }
    }

    private static Map<String, Set<String>> defaultDependencies() {
        Map<String, Set<String>> dependencies = new LinkedHashMap<>();
        dependencies.put("member:create", Set.of("member:read"));
        dependencies.put("member:update", Set.of("member:read"));
        dependencies.put("member:delete", Set.of("member:read"));
        dependencies.put("member:status:update", Set.of("member:read"));
        dependencies.put("book:create", Set.of("book:read"));
        dependencies.put("book:update", Set.of("book:read"));
        dependencies.put("book:delete", Set.of("book:read"));
        dependencies.put("book:import", Set.of("book:read"));
        dependencies.put("role:update", Set.of("role:read"));
        dependencies.put("borrow:cancel-own", Set.of("borrow:read-own"));
        dependencies.put("borrow:renew", Set.of("borrow:read-own"));
        dependencies.put("borrow:prepare", Set.of("borrow:read"));
        dependencies.put("borrow:cancel", Set.of("borrow:read"));
        dependencies.put("borrow:fee-confirm", Set.of("borrow:read"));
        dependencies.put("borrow:handover", Set.of("borrow:read", "borrow:fee-confirm"));
        return dependencies;
    }
}
