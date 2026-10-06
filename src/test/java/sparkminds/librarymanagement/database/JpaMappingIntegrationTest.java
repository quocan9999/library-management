package sparkminds.librarymanagement.database;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.lang.reflect.Field;
import java.lang.reflect.ParameterizedType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Column;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.metamodel.Attribute;
import jakarta.persistence.metamodel.EntityType;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class JpaMappingIntegrationTest {

    private static final String ENTITY_PACKAGE = "sparkminds.librarymanagement.entity.";

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Test
    void registersAuthEntitiesWithExactIdsTablesAndOwningRelationships() throws Exception {
        Class<?> roleClass = assertDoesNotThrow(() -> Class.forName(ENTITY_PACKAGE + "Role"));
        Class<?> permissionClass = assertDoesNotThrow(() -> Class.forName(ENTITY_PACKAGE + "Permission"));
        Class<?> accountClass = assertDoesNotThrow(() -> Class.forName(ENTITY_PACKAGE + "Account"));

        EntityType<?> role = entityManagerFactory.getMetamodel().entity(roleClass);
        EntityType<?> permission = entityManagerFactory.getMetamodel().entity(permissionClass);
        EntityType<?> account = entityManagerFactory.getMetamodel().entity(accountClass);

        assertEquals("roles", roleClass.getAnnotation(Table.class).name());
        assertEquals("permissions", permissionClass.getAnnotation(Table.class).name());
        assertEquals("accounts", accountClass.getAnnotation(Table.class).name());
        assertEquals(Short.class, role.getIdType().getJavaType());
        assertEquals(Short.class, permission.getIdType().getJavaType());
        assertEquals(Integer.class, account.getIdType().getJavaType());

        Attribute<?, ?> roleAccounts = role.getAttribute("accounts");
        Attribute<?, ?> accountRole = account.getAttribute("role");
        assertEquals(Attribute.PersistentAttributeType.ONE_TO_MANY, roleAccounts.getPersistentAttributeType());
        assertEquals(Attribute.PersistentAttributeType.MANY_TO_ONE, accountRole.getPersistentAttributeType());
        assertEquals("role", field(roleClass, "accounts").getAnnotation(OneToMany.class).mappedBy());
        assertEquals("role_id", field(accountClass, "role").getAnnotation(JoinColumn.class).name());

        Attribute<?, ?> rolePermissions = role.getAttribute("permissions");
        Attribute<?, ?> permissionRoles = permission.getAttribute("roles");
        assertEquals(Attribute.PersistentAttributeType.MANY_TO_MANY, rolePermissions.getPersistentAttributeType());
        assertEquals(Attribute.PersistentAttributeType.MANY_TO_MANY, permissionRoles.getPersistentAttributeType());
        ManyToMany owningMapping = field(roleClass, "permissions").getAnnotation(ManyToMany.class);
        assertEquals("", owningMapping.mappedBy());
        JoinTable joinTable = field(roleClass, "permissions").getAnnotation(JoinTable.class);
        assertEquals("role_permissions", joinTable.name());
        assertEquals(List.of("role_id"), List.of(joinTable.joinColumns()).stream().map(JoinColumn::name).toList());
        assertEquals(List.of("permission_id"), List.of(joinTable.inverseJoinColumns()).stream().map(JoinColumn::name).toList());
        assertEquals("permissions", field(permissionClass, "roles").getAnnotation(ManyToMany.class).mappedBy());
        assertFalse(accountRole.isCollection());
    }

    @Test
    void registersRemainingEntitiesWithExactIdsTemporalTypesAndRepositoryIds() throws Exception {
        assertEntity("RefreshToken", "refresh_tokens", Integer.class);
        assertEntity("RevokedAccessToken", "revoked_access_tokens", Integer.class);
        assertEntity("EmailVerificationToken", "email_verification_tokens", Integer.class);
        assertEntity("PasswordResetToken", "password_reset_tokens", Integer.class);
        assertEntity("EmailChangeVerification", "email_change_verifications", Integer.class);
        assertEntity("Member", "members", Integer.class);
        assertEntity("Book", "books", Integer.class);
        assertEntity("Loan", "loans", Integer.class);
        assertEntity("LoanItem", "loan_items", Integer.class);
        assertEntity("SystemConfig", "system_configs", Byte.class);

        assertRepositoryId("RefreshTokenRepository", Integer.class);
        assertRepositoryId("RevokedAccessTokenRepository", Integer.class);
        assertRepositoryId("EmailVerificationTokenRepository", Integer.class);
        assertRepositoryId("PasswordResetTokenRepository", Integer.class);
        assertRepositoryId("EmailChangeVerificationRepository", Integer.class);
        assertRepositoryId("MemberRepository", Integer.class);
        assertRepositoryId("BookRepository", Integer.class);
        assertRepositoryId("LoanRepository", Integer.class);
        assertRepositoryId("LoanItemRepository", Integer.class);
        assertRepositoryId("SystemConfigRepository", Byte.class);

        assertFieldType("Member", "dateOfBirth", LocalDate.class);
        assertFieldType("Book", "publishedDate", LocalDate.class);
        assertFieldType("Loan", "borrowedAt", LocalDateTime.class);
        assertFieldType("Loan", "dueDate", LocalDate.class);
        assertFieldType("LoanItem", "returnedAt", LocalDateTime.class);
        assertFieldType("SystemConfig", "id", Byte.class);
        assertFieldType("Book", "borrowFee", BigDecimal.class);
        assertFieldType("Book", "lateFeePerDay", BigDecimal.class);
        assertFieldType("LoanItem", "borrowFee", BigDecimal.class);
        assertFieldType("LoanItem", "lateFeePerDay", BigDecimal.class);
        assertFieldType("LoanItem", "lateFee", BigDecimal.class);
        assertEquals(12, field("Book", "borrowFee").getAnnotation(Column.class).precision());
        assertEquals(2, field("Book", "borrowFee").getAnnotation(Column.class).scale());
        assertEquals(12, field("LoanItem", "lateFee").getAnnotation(Column.class).precision());
        assertEquals(2, field("LoanItem", "lateFee").getAnnotation(Column.class).scale());

        assertRelationship("Member", "account", Attribute.PersistentAttributeType.ONE_TO_ONE);
        assertRelationship("Account", "member", Attribute.PersistentAttributeType.ONE_TO_ONE);
        assertEquals("account", field("Account", "member").getAnnotation(OneToOne.class).mappedBy());
        assertEquals("account_id", field("Member", "account").getAnnotation(JoinColumn.class).name());
        assertRelationship("Loan", "member", Attribute.PersistentAttributeType.MANY_TO_ONE);
        assertRelationship("Member", "loans", Attribute.PersistentAttributeType.ONE_TO_MANY);
        assertEquals("member", field("Member", "loans").getAnnotation(OneToMany.class).mappedBy());
        assertRelationship("LoanItem", "loan", Attribute.PersistentAttributeType.MANY_TO_ONE);
        assertRelationship("LoanItem", "book", Attribute.PersistentAttributeType.MANY_TO_ONE);
        assertRelationship("Loan", "items", Attribute.PersistentAttributeType.ONE_TO_MANY);
        assertRelationship("Book", "loanItems", Attribute.PersistentAttributeType.ONE_TO_MANY);
        assertEquals("loan", field("Loan", "items").getAnnotation(OneToMany.class).mappedBy());
        assertEquals("book", field("Book", "loanItems").getAnnotation(OneToMany.class).mappedBy());
        assertEquals("member_id", field("Loan", "member").getAnnotation(JoinColumn.class).name());
        assertEquals("loan_id", field("LoanItem", "loan").getAnnotation(JoinColumn.class).name());
        assertEquals("book_id", field("LoanItem", "book").getAnnotation(JoinColumn.class).name());
    }

    private void assertEntity(String simpleName, String tableName, Class<?> idType) throws Exception {
        Class<?> entityClass = entityClass(simpleName);
        EntityType<?> entity = entityManagerFactory.getMetamodel().entity(entityClass);
        assertEquals(tableName, entityClass.getAnnotation(Table.class).name());
        assertEquals(idType, entity.getIdType().getJavaType());
    }

    private void assertRepositoryId(String simpleName, Class<?> idType) throws Exception {
        Class<?> repositoryClass = Class.forName("sparkminds.librarymanagement.repository." + simpleName);
        ParameterizedType repositoryInterface = (ParameterizedType) repositoryClass.getGenericInterfaces()[0];
        assertEquals(idType, repositoryInterface.getActualTypeArguments()[1]);
    }

    private void assertFieldType(String entityName, String fieldName, Class<?> fieldType) throws Exception {
        assertEquals(fieldType, field(entityName, fieldName).getType());
    }

    private void assertRelationship(
            String entityName, String fieldName, Attribute.PersistentAttributeType relationship) throws Exception {
        EntityType<?> entity = entityManagerFactory.getMetamodel().entity(entityClass(entityName));
        assertEquals(relationship, entity.getAttribute(fieldName).getPersistentAttributeType());
    }

    private Class<?> entityClass(String simpleName) {
        return assertDoesNotThrow(() -> Class.forName(ENTITY_PACKAGE + simpleName));
    }

    private Field field(Class<?> entityClass, String fieldName) throws NoSuchFieldException {
        return entityClass.getDeclaredField(fieldName);
    }

    private Field field(String entityName, String fieldName) throws Exception {
        return field(entityClass(entityName), fieldName);
    }
}
