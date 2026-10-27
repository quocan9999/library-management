package sparkminds.librarymanagement.integration.profile;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.member.entity.Member;
import sparkminds.librarymanagement.member.repository.MemberRepository;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class UserProfileIntegrationTests {

    private static final String PROFILE_PATH = "/api/v1/profile";
    private static final String PASSWORD = "Password123!";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private RoleRepositoy roleRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void userCanGetAndPatchProfileSuccessfully() throws Exception {
        Account userAccount = createAccount("USER");
        Member member = createMember(userAccount, "M000099", "Nguyễn Văn A", "0912345678", LocalDate.of(1995, 5, 15), "Hà Nội");

        String token = loginAndGetToken(userAccount.getEmail(), PASSWORD);

        // GET profile
        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PROFILE_FETCHED"))
                .andExpect(jsonPath("$.data.email").value(userAccount.getEmail()))
                .andExpect(jsonPath("$.data.fullName").value("Nguyễn Văn A"))
                .andExpect(jsonPath("$.data.phone").value("0912345678"))
                .andExpect(jsonPath("$.data.dateOfBirth").value("1995-05-15"))
                .andExpect(jsonPath("$.data.address").value("Hà Nội"))
                .andExpect(jsonPath("$.data.memberCode").value("M000099"))
                .andExpect(jsonPath("$.data.version").value(member.getVersion()));

        long initialVersion = member.getVersion();

        // PATCH profile
        String patchBody = """
                {
                    "version": %d,
                    "fullName": "Nguyễn Văn B",
                    "phone": "0987654321",
                    "dateOfBirth": "1998-08-20",
                    "address": "TP Hồ Chí Minh"
                }
                """.formatted(initialVersion);

        mockMvc.perform(patch(PROFILE_PATH)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patchBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PROFILE_UPDATED"))
                .andExpect(jsonPath("$.data.fullName").value("Nguyễn Văn B"))
                .andExpect(jsonPath("$.data.phone").value("0987654321"))
                .andExpect(jsonPath("$.data.dateOfBirth").value("1998-08-20"))
                .andExpect(jsonPath("$.data.address").value("TP Hồ Chí Minh"))
                .andExpect(jsonPath("$.data.version").value(initialVersion + 1));

        Member updatedMember = memberRepository.findById(member.getId()).orElseThrow();
        assertThat(updatedMember.getFullName()).isEqualTo("Nguyễn Văn B");
        assertThat(updatedMember.getPhone()).isEqualTo("0987654321");
        assertThat(updatedMember.getDateOfBirth()).isEqualTo(LocalDate.of(1998, 8, 20));
        assertThat(updatedMember.getAddress()).isEqualTo("TP Hồ Chí Minh");
    }

    @Test
    void adminCanGetProfileWithoutMemberDetails() throws Exception {
        Account adminAccount = createAccount("ADMIN");
        String token = loginAndGetToken(adminAccount.getEmail(), PASSWORD);

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PROFILE_FETCHED"))
                .andExpect(jsonPath("$.data.email").value(adminAccount.getEmail()))
                .andExpect(jsonPath("$.data.role").value("ADMIN"))
                .andExpect(jsonPath("$.data.memberCode").doesNotExist());
    }

    @Test
    void patchProfileRejectsVersionConflict() throws Exception {
        Account userAccount = createAccount("USER");
        Member member = createMember(userAccount, "M000098", "Trần Văn C", "0911223344", LocalDate.of(1990, 1, 1), "Đà Nẵng");

        String token = loginAndGetToken(userAccount.getEmail(), PASSWORD);

        String stalePatchBody = """
                {
                    "version": %d,
                    "fullName": "Trần Văn D"
                }
                """.formatted(member.getVersion() + 99);

        mockMvc.perform(patch(PROFILE_PATH)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(stalePatchBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEMBER_VERSION_CONFLICT"));
    }

    @Test
    void patchProfileRejectsUnderageDateOfBirth() throws Exception {
        Account userAccount = createAccount("USER");
        Member member = createMember(userAccount, "M000097", "Lê Văn E", "0933445566", LocalDate.of(1995, 1, 1), "Huế");

        String token = loginAndGetToken(userAccount.getEmail(), PASSWORD);

        LocalDate underageBirth = LocalDate.now().minusYears(10);
        String patchBody = """
                {
                    "version": %d,
                    "dateOfBirth": "%s"
                }
                """.formatted(member.getVersion(), underageBirth);

        mockMvc.perform(patch(PROFILE_PATH)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patchBody))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MEMBER_PATCH_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.dateOfBirth").value("Ngày sinh phải hợp lệ và thành viên đủ 16 tuổi"));
    }

    @Test
    void patchProfileRejectsDuplicatePhone() throws Exception {
        Account user1 = createAccount("USER");
        createMember(user1, "M000095", "Người 1", "0912121212", LocalDate.of(1990, 1, 1), "Hà Nội");

        Account user2 = createAccount("USER");
        Member member2 = createMember(user2, "M000096", "Người 2", "0934343434", LocalDate.of(1990, 1, 1), "Hà Nội");

        String token2 = loginAndGetToken(user2.getEmail(), PASSWORD);

        String patchBody = """
                {
                    "version": %d,
                    "phone": "0912121212"
                }
                """.formatted(member2.getVersion());

        mockMvc.perform(patch(PROFILE_PATH)
                        .header("Authorization", "Bearer " + token2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patchBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEMBER_PHONE_DUPLICATED"));
    }

    private Account createAccount(String roleCode) {
        Account account = new Account();
        account.setEmail(UUID.randomUUID() + "@example.com");
        account.setPasswordHash(passwordEncoder.encode(PASSWORD));
        account.setRole(roleRepository.findByCode(roleCode).orElseThrow());
        account.setEnabled(true);
        account.setEmailVerified(true);
        return accountRepository.saveAndFlush(account);
    }

    private Member createMember(Account account, String memberCode, String fullName, String phone, LocalDate dob, String address) {
        Member member = new Member();
        member.setAccount(account);
        member.setMemberCode(memberCode);
        member.setFullName(fullName);
        member.setPhone(phone);
        member.setDateOfBirth(dob);
        member.setAddress(address);
        return memberRepository.saveAndFlush(member);
    }

    private String loginAndGetToken(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(MAPPER.writeValueAsString(Map.of("identifier", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        return MAPPER.readTree(result.getResponse().getContentAsString())
                .get("data").get("accessToken").asText();
    }
}
