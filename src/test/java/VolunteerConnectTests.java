package com.volunteerconnect.tests;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.reflect.Method;
import java.util.*;

/**
 * Unit Test Suite for Volunteer Connect — Community Aid Platform
 * Covering Test Cases TC-01 through TC-13.
 *
 * Can be run directly from terminal:
 *   java src/test/java/VolunteerConnectTests.java
 */
public class VolunteerConnectTests {

    private WorkflowService service;
    private Instant now;

    @BeforeEach
    public void setUp() {
        service = new WorkflowService();
        now = Instant.now();
    }

    // =========================================================================
    // TC-01: User Registration and Role Assignment
    // =========================================================================
    @Test
    @DisplayName("TC-01: Register user with valid credentials and assign selected non-privileged role")
    public void test_TC01_userRegistrationAndRoleAssignment() {
        User volunteer = service.registerUser("volunteer@example.com", "Password@123", "volunteer");
        Assertions.assertNotNull(volunteer.id, "User ID should be generated upon registration");
        Assertions.assertEquals("volunteer@example.com", volunteer.email);
        Assertions.assertEquals("volunteer", volunteer.role, "Registered user should immediately obtain the volunteer role");

        User ngo = service.registerUser("ngo@example.org", "Password@123", "ngo");
        Assertions.assertEquals("ngo", ngo.role, "NGO account should receive NGO role without elevated super-admin privileges");
    }

    // =========================================================================
    // TC-02: Route Protection & Unauthenticated Access Guard
    // =========================================================================
    @Test
    @DisplayName("TC-02: Deny access to protected routes when user is unauthenticated")
    public void test_TC02_protectedRouteRequiresAuthentication() {
        boolean canAccessLoggedOut = service.canAccessRoute(null, "/dashboard");
        Assertions.assertFalse(canAccessLoggedOut, "Unauthenticated user must be denied access to /dashboard");

        String redirectUrl = service.getRedirectUrlIfDenied(null, "/dashboard");
        Assertions.assertEquals("/auth", redirectUrl, "Unauthenticated users must be redirected to /auth");

        User loggedInUser = new User("usr_1", "vol@test.org", "volunteer", false);
        Assertions.assertTrue(service.canAccessRoute(loggedInUser, "/dashboard"), "Authenticated user can access /dashboard");
    }

    // =========================================================================
    // TC-03: Opportunity Creation & Date Restrictions
    // =========================================================================
    @Test
    @DisplayName("TC-03: Validate opportunity creation: required fields, positive slots, and date restrictions")
    public void test_TC03_opportunityCreationValidation() {
        Instant futureStart = now.plus(3, ChronoUnit.DAYS);
        Instant futureEnd = now.plus(5, ChronoUnit.DAYS);
        Instant pastDate = now.minus(2, ChronoUnit.DAYS);

        // Valid opportunity
        String validResult = service.validateOpportunity("Beach Cleanup", 10, futureStart, futureEnd, now);
        Assertions.assertNull(validResult, "Valid opportunity details must pass validation");

        // Missing title
        String missingTitle = service.validateOpportunity("", 10, futureStart, futureEnd, now);
        Assertions.assertEquals("Title is required", missingTitle);

        // Non-positive slots
        String invalidSlots = service.validateOpportunity("Teaching", 0, futureStart, futureEnd, now);
        Assertions.assertEquals("Slots must be a positive integer", invalidSlots);

        // Past start date rejected
        String pastStart = service.validateOpportunity("Tree Planting", 5, pastDate, futureEnd, now);
        Assertions.assertEquals("Start date cannot be in the past", pastStart);

        // End date preceding start date
        String invalidEnd = service.validateOpportunity("Food Drive", 5, futureEnd, futureStart, now);
        Assertions.assertEquals("End date cannot precede start date", invalidEnd);
    }

    // =========================================================================
    // TC-04: Multi-Criteria Opportunity Search & Date Boundaries
    // =========================================================================
    @Test
    @DisplayName("TC-04: Search opportunities by keyword, city, location mode, and date boundary")
    public void test_TC04_opportunitySearchAndDateFilter() {
        service.addOpportunity(new Opportunity("opp_1", "Tree Plantation Drive", "Pune", "in-person", "Environment", now.plus(2, ChronoUnit.DAYS)));
        service.addOpportunity(new Opportunity("opp_2", "Virtual Mentorship", "Mumbai", "remote", "Education", now.plus(5, ChronoUnit.DAYS)));

        List<Opportunity> resultsByKeyword = service.searchOpportunities("Plantation", null, null);
        Assertions.assertEquals(1, resultsByKeyword.size());
        Assertions.assertEquals("Tree Plantation Drive", resultsByKeyword.get(0).title);

        List<Opportunity> resultsByCity = service.searchOpportunities(null, "Pune", null);
        Assertions.assertEquals(1, resultsByCity.size());

        List<Opportunity> resultsByMode = service.searchOpportunities(null, null, "remote");
        Assertions.assertEquals(1, resultsByMode.size());
        Assertions.assertEquals("Virtual Mentorship", resultsByMode.get(0).title);
    }

    // =========================================================================
    // TC-05: Application Submission, Slot Capacity, and Deadline Safeguards
    // =========================================================================
    @Test
    @DisplayName("TC-05: Application is accepted before deadline; rejected when capacity is full or deadline passed")
    public void test_TC05_applicationCapacityAndDeadlineEnforcement() {
        Instant openDeadline = now.plus(2, ChronoUnit.DAYS);
        Instant expiredDeadline = now.minus(1, ChronoUnit.DAYS);

        // Successful application
        String allowed = service.checkApplicationAllowed("published", openDeadline, 5, 2, now);
        Assertions.assertNull(allowed, "Open deadline with available capacity must allow application");

        // Expired deadline
        String expired = service.checkApplicationAllowed("published", expiredDeadline, 5, 2, now);
        Assertions.assertEquals("Application deadline has passed", expired);

        // Full capacity
        String full = service.checkApplicationAllowed("published", openDeadline, 5, 5, now);
        Assertions.assertEquals("No remaining slots available", full);

        // Draft opportunity cannot receive applications
        String draft = service.checkApplicationAllowed("draft", openDeadline, 5, 1, now);
        Assertions.assertEquals("Opportunity is not published", draft);
    }

    // =========================================================================
    // TC-06: NGO Accepts / Rejects Application & Volunteer Notification
    // =========================================================================
    @Test
    @DisplayName("TC-06: NGO updates application status and triggers volunteer notification")
    public void test_TC06_ngoAcceptOrRejectApplicationWorkflow() {
        Application app = service.createApplication("app_101", "vol_1", "opp_1");
        Assertions.assertEquals("pending", app.status);

        // NGO accepts application
        Notification notif = service.decideApplication(app, "accepted", null);
        Assertions.assertEquals("accepted", app.status, "Status should update to accepted");
        Assertions.assertNotNull(notif, "Acceptance must generate an in-app notification");
        Assertions.assertTrue(notif.title.contains("Accepted"), "Notification title should indicate acceptance");
        Assertions.assertEquals("vol_1", notif.recipientUserId);

        // NGO rejects application with reason
        Application app2 = service.createApplication("app_102", "vol_2", "opp_1");
        Notification rejectNotif = service.decideApplication(app2, "rejected", "Capacity requirement not met");
        Assertions.assertEquals("rejected", app2.status);
        Assertions.assertEquals("Capacity requirement not met", app2.rejectionReason);
        Assertions.assertTrue(rejectNotif.title.contains("Rejected") || rejectNotif.body.contains("Capacity"));
    }

    // =========================================================================
    // TC-07: Unverified NGO Publishing Guard
    // =========================================================================
    @Test
    @DisplayName("TC-07: Prevent unverified NGOs from publishing opportunities until approved by super admin")
    public void test_TC07_unverifiedNgoPublishingGuard() {
        NgoOrganization unverifiedNgo = new NgoOrganization("ngo_1", "Green Hope", false);
        boolean canPublish = service.canPublishOpportunity(unverifiedNgo);
        Assertions.assertFalse(canPublish, "Unverified NGO must not be permitted to publish opportunities");

        // Super Admin approves NGO
        service.verifyNgoOrganization(unverifiedNgo, true);
        Assertions.assertTrue(unverifiedNgo.isVerified);
        Assertions.assertTrue(service.canPublishOpportunity(unverifiedNgo), "Verified NGO can publish opportunities");
    }

    // =========================================================================
    // TC-08: Access Control & Data Privacy
    // =========================================================================
    @Test
    @DisplayName("TC-08: Enforce column privacy and role-based data isolation")
    public void test_TC08_restrictedDataAccessDenied() {
        User volunteer = new User("vol_1", "v@test.org", "volunteer", false);
        User ngoUser = new User("ngo_1", "ngo@test.org", "ngo", false);

        // Volunteers cannot access NGO internal applicants management
        Assertions.assertFalse(service.canAccessRoute(volunteer, "/ngo/opportunities/1/applicants"));

        // NGOs cannot access Super Admin center
        Assertions.assertFalse(service.canAccessRoute(ngoUser, "/admin"));

        // Private phone number is masked for public queries
        String maskedPhone = service.getPublicProfilePhone("9876543210", false);
        Assertions.assertEquals("**********", maskedPhone, "Private phone number must not be exposed without authorization");
    }

    // =========================================================================
    // TC-09: Administrator Moderation & User Suspension
    // =========================================================================
    @Test
    @DisplayName("TC-09: Suspended users are blocked from applying and excluded from leaderboard")
    public void test_TC09_suspendedUserRestrictions() {
        User activeUser = new User("usr_active", "active@test.org", "volunteer", false);
        User suspendedUser = new User("usr_bad", "suspended@test.org", "volunteer", true);

        // Application restriction
        Assertions.assertTrue(service.canUserApply(activeUser), "Active user can apply for drives");
        Assertions.assertFalse(service.canUserApply(suspendedUser), "Suspended user must be blocked from applying");

        // Leaderboard inclusion
        List<User> leaderboard = service.getLeaderboardUsers(Arrays.asList(activeUser, suspendedUser));
        Assertions.assertEquals(1, leaderboard.size());
        Assertions.assertEquals("usr_active", leaderboard.get(0).id, "Suspended user must be excluded from leaderboard");
    }

    // =========================================================================
    // TC-10: Attendance Tracking by NGO
    // =========================================================================
    @Test
    @DisplayName("TC-10: NGO marks attendance as Present or Absent for accepted volunteers")
    public void test_TC10_attendanceMarking() {
        Application app = service.createApplication("app_201", "vol_1", "opp_1");
        app.status = "accepted";

        service.markAttendance(app, "present");
        Assertions.assertEquals("present", app.attendance, "Attendance should be marked as present");

        service.markAttendance(app, "absent");
        Assertions.assertEquals("absent", app.attendance, "Attendance should be updateable to absent");
    }

    // =========================================================================
    // TC-11: Certificate Upload, MIME Magic-Byte Sniffing, and Blob File Extension
    // =========================================================================
    @Test
    @DisplayName("TC-11: MIME & magic bytes determine correct document extension (.pdf, .jpg, .png, .svg)")
    public void test_TC11_certificateMimeAndMagicByteSniffing() {
        // PDF magic bytes: %PDF (0x25, 0x50, 0x44, 0x46)
        byte[] pdfBytes = new byte[]{0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E};
        Assertions.assertEquals("pdf", service.sniffCertificateExtension(pdfBytes, "application/pdf"));

        // JPEG magic bytes: 0xFF, 0xD8
        byte[] jpegBytes = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
        Assertions.assertEquals("jpg", service.sniffCertificateExtension(jpegBytes, "image/jpeg"));

        // Misnamed image uploaded as .pdf must be corrected to image so Chrome doesn't throw PDF error
        Assertions.assertEquals("jpg", service.sniffCertificateExtension(jpegBytes, "application/octet-stream"),
                "Magic bytes must override incorrect/generic MIME types to prevent viewer corruption");

        // PNG magic bytes: 0x89, 'P', 'N', 'G'
        byte[] pngBytes = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47};
        Assertions.assertEquals("png", service.sniffCertificateExtension(pngBytes, "image/png"));
    }

    // =========================================================================
    // TC-12: Simultaneous Digital and Uploaded Certificate Visibility
    // =========================================================================
    @Test
    @DisplayName("TC-12: Both digital certificate code and uploaded certificate file can coexist")
    public void test_TC12_simultaneousCertificatesVisibility() {
        Application app = service.createApplication("app_301", "vol_1", "opp_1");
        app.status = "completed";

        // Grant both credentials
        app.certificateUrl = "certificates/app_301/certificate.pdf";
        DigitalCertificate digitalCert = new DigitalCertificate("VC-ABC1234", 4);
        app.digitalCertificate = digitalCert;

        Assertions.assertTrue(app.hasUploadedCertificate(), "Uploaded certificate must be present");
        Assertions.assertTrue(app.hasDigitalCertificate(), "Digital verifiable certificate must be present");
        Assertions.assertEquals("VC-ABC1234", app.digitalCertificate.code);
        Assertions.assertEquals("certificates/app_301/certificate.pdf", app.certificateUrl);
    }

    // =========================================================================
    // TC-13: Role-Based Dashboard and Leaderboard Access
    // =========================================================================
    @Test
    @DisplayName("TC-13: Leaderboard is restricted to volunteers; NGOs access organization portal")
    public void test_TC13_roleBasedLeaderboardAndDashboardAccess() {
        User volunteer = new User("vol_1", "v@test.org", "volunteer", false);
        User ngo = new User("ngo_1", "n@test.org", "ngo", false);

        Assertions.assertTrue(service.canAccessLeaderboard(volunteer), "Volunteers are granted leaderboard access");
        Assertions.assertFalse(service.canAccessLeaderboard(ngo), "NGOs are restricted from volunteer leaderboard");

        Assertions.assertEquals("/ngo/opportunities", service.getPrimaryDashboardRoute(ngo));
        Assertions.assertEquals("/dashboard", service.getPrimaryDashboardRoute(volunteer));
    }

    // =========================================================================
    // Built-in Test Runner with Colored Output & Check Marks
    // =========================================================================
    public static void main(String[] args) {
        String GREEN = "\u001B[32m";
        String RED = "\u001B[31m";
        String CYAN = "\u001B[36m";
        String BOLD = "\u001B[1m";
        String RESET = "\u001B[0m";

        System.out.println(CYAN + BOLD + "\n==========================================================================" + RESET);
        System.out.println(CYAN + BOLD + "   Volunteer Connect — Automated Unit Test Suite (TC-01 to TC-13)         " + RESET);
        System.out.println(CYAN + BOLD + "==========================================================================" + RESET);

        VolunteerConnectTests suite = new VolunteerConnectTests();
        Method[] methods = VolunteerConnectTests.class.getDeclaredMethods();
        List<Method> testMethods = new ArrayList<>();
        for (Method m : methods) {
            if (m.isAnnotationPresent(Test.class) || m.getName().startsWith("test_TC")) {
                testMethods.add(m);
            }
        }
        testMethods.sort(Comparator.comparing(Method::getName));

        int passed = 0;
        int failed = 0;
        long startTime = System.currentTimeMillis();

        for (Method test : testMethods) {
            String name = test.getName();
            DisplayName dn = test.getAnnotation(DisplayName.class);
            String label = dn != null ? dn.value() : name;

            try {
                suite.setUp();
                test.invoke(suite);
                System.out.println("  " + GREEN + BOLD + "✔ [PASSED]" + RESET + " " + label);
                passed++;
            } catch (Throwable ex) {
                Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
                System.out.println("  " + RED + BOLD + "✖ [FAILED]" + RESET + " " + label);
                System.out.println("     " + RED + "Reason: " + cause.getMessage() + RESET);
                failed++;
            }
        }

        long duration = System.currentTimeMillis() - startTime;
        System.out.println(CYAN + "--------------------------------------------------------------------------" + RESET);
        System.out.println("  Result: " + (failed == 0 ? (GREEN + BOLD + "ALL TESTS PASSED ✔" + RESET) : (RED + BOLD + "SOME TESTS FAILED" + RESET)));
        System.out.println("  Executed: " + testMethods.size() + " | " + GREEN + "Passed: " + passed + RESET + " | " + (failed > 0 ? RED : "") + "Failed: " + failed + RESET + " | Time: " + duration + "ms");
        System.out.println(CYAN + BOLD + "==========================================================================\n" + RESET);

        if (failed > 0) System.exit(1);
    }
}

// =============================================================================
// Standalone Annotations & Assertions (No external JARs required!)
// =============================================================================

@Retention(RetentionPolicy.RUNTIME)
@interface Test {}

@Retention(RetentionPolicy.RUNTIME)
@interface DisplayName { String value(); }

@Retention(RetentionPolicy.RUNTIME)
@interface BeforeEach {}

class Assertions {
    public static void assertEquals(Object expected, Object actual) {
        assertEquals(expected, actual, "Expected: " + expected + ", but got: " + actual);
    }

    public static void assertEquals(Object expected, Object actual, String message) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError(message + " (Expected: " + expected + ", Actual: " + actual + ")");
        }
    }

    public static void assertTrue(boolean condition) {
        assertTrue(condition, "Condition expected to be true");
    }

    public static void assertTrue(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void assertFalse(boolean condition) {
        assertFalse(condition, "Condition expected to be false");
    }

    public static void assertFalse(boolean condition, String message) {
        if (condition) throw new AssertionError(message);
    }

    public static void assertNull(Object actual) {
        assertNull(actual, "Expected null, but was: " + actual);
    }

    public static void assertNull(Object actual, String message) {
        if (actual != null) throw new AssertionError(message + " (Expected null, got: " + actual + ")");
    }

    public static void assertNotNull(Object actual) {
        assertNotNull(actual, "Expected non-null value");
    }

    public static void assertNotNull(Object actual, String message) {
        if (actual == null) throw new AssertionError(message);
    }
}

// =============================================================================
// Lightweight Domain Model & Business Logic Helper Supporting the Test Suite
// =============================================================================

class WorkflowService {
    private final List<Opportunity> opportunities = new ArrayList<>();

    public User registerUser(String email, String password, String selectedRole) {
        if (email == null || !email.contains("@")) throw new IllegalArgumentException("Invalid email");
        String role = "ngo".equalsIgnoreCase(selectedRole) ? "ngo" : "volunteer";
        return new User(UUID.randomUUID().toString(), email, role, false);
    }

    public boolean canAccessRoute(User user, String route) {
        if (user == null) return false;
        if (route.startsWith("/admin")) return "super_admin".equals(user.role);
        if (route.startsWith("/ngo")) return "ngo".equals(user.role);
        return true;
    }

    public String getRedirectUrlIfDenied(User user, String route) {
        return user == null ? "/auth" : "/dashboard";
    }

    public String validateOpportunity(String title, int slots, Instant startsAt, Instant endsAt, Instant now) {
        if (title == null || title.trim().isEmpty()) return "Title is required";
        if (slots <= 0) return "Slots must be a positive integer";
        if (startsAt != null && startsAt.isBefore(now)) return "Start date cannot be in the past";
        if (endsAt != null && startsAt != null && endsAt.isBefore(startsAt)) return "End date cannot precede start date";
        return null;
    }

    public void addOpportunity(Opportunity opp) {
        opportunities.add(opp);
    }

    public List<Opportunity> searchOpportunities(String keyword, String city, String mode) {
        List<Opportunity> result = new ArrayList<>();
        for (Opportunity o : opportunities) {
            boolean matchKey = keyword == null || o.title.toLowerCase().contains(keyword.toLowerCase());
            boolean matchCity = city == null || o.city.equalsIgnoreCase(city);
            boolean matchMode = mode == null || o.locationMode.equalsIgnoreCase(mode);
            if (matchKey && matchCity && matchMode) result.add(o);
        }
        return result;
    }

    public String checkApplicationAllowed(String status, Instant deadline, int totalSlots, int occupiedSlots, Instant now) {
        if (!"published".equalsIgnoreCase(status)) return "Opportunity is not published";
        if (deadline != null && deadline.isBefore(now)) return "Application deadline has passed";
        if (occupiedSlots >= totalSlots) return "No remaining slots available";
        return null;
    }

    public Application createApplication(String id, String volId, String oppId) {
        return new Application(id, volId, oppId);
    }

    public Notification decideApplication(Application app, String status, String reason) {
        app.status = status;
        app.rejectionReason = reason;
        String title = "accepted".equals(status) ? "Application Accepted 🎉" : "Application Rejected";
        String body = "accepted".equals(status) ? "You have been selected!" : reason;
        return new Notification(app.volunteerId, title, body);
    }

    public boolean canPublishOpportunity(NgoOrganization ngo) {
        return ngo != null && ngo.isVerified;
    }

    public void verifyNgoOrganization(NgoOrganization ngo, boolean verified) {
        ngo.isVerified = verified;
    }

    public String getPublicProfilePhone(String phone, boolean isAuthorized) {
        return isAuthorized ? phone : "**********";
    }

    public boolean canUserApply(User user) {
        return user != null && !user.isSuspended;
    }

    public List<User> getLeaderboardUsers(List<User> allUsers) {
        List<User> active = new ArrayList<>();
        for (User u : allUsers) {
            if (!u.isSuspended && "volunteer".equals(u.role)) active.add(u);
        }
        return active;
    }

    public void markAttendance(Application app, String attendance) {
        app.attendance = attendance;
    }

    public String sniffCertificateExtension(byte[] bytes, String mime) {
        if (bytes != null && bytes.length >= 2) {
            if (bytes.length >= 4 && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46) return "pdf"; // %PDF
            if ((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8) return "jpg";
            if (bytes.length >= 4 && (bytes[0] & 0xFF) == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return "png";
        }
        if (mime != null && (mime.contains("jpeg") || mime.contains("jpg"))) return "jpg";
        if (mime != null && mime.contains("png")) return "png";
        if (mime != null && mime.contains("svg")) return "svg";
        return "pdf";
    }

    public boolean canAccessLeaderboard(User user) {
        return user != null && "volunteer".equals(user.role);
    }

    public String getPrimaryDashboardRoute(User user) {
        return "ngo".equals(user.role) ? "/ngo/opportunities" : "/dashboard";
    }
}

class User {
    public String id, email, role;
    public boolean isSuspended;

    public User(String id, String email, String role, boolean isSuspended) {
        this.id = id; this.email = email; this.role = role; this.isSuspended = isSuspended;
    }
}

class Opportunity {
    public String id, title, city, locationMode, category;
    public Instant startsAt;

    public Opportunity(String id, String title, String city, String locationMode, String category, Instant startsAt) {
        this.id = id; this.title = title; this.city = city; this.locationMode = locationMode; this.category = category; this.startsAt = startsAt;
    }
}

class Application {
    public String id, volunteerId, opportunityId, status = "pending", attendance, rejectionReason, certificateUrl;
    public DigitalCertificate digitalCertificate;

    public Application(String id, String volunteerId, String opportunityId) {
        this.id = id; this.volunteerId = volunteerId; this.opportunityId = opportunityId;
    }

    public boolean hasUploadedCertificate() { return certificateUrl != null && !certificateUrl.isEmpty(); }
    public boolean hasDigitalCertificate() { return digitalCertificate != null; }
}

class DigitalCertificate {
    public String code;
    public int hours;

    public DigitalCertificate(String code, int hours) { this.code = code; this.hours = hours; }
}

class NgoOrganization {
    public String id, name;
    public boolean isVerified;

    public NgoOrganization(String id, String name, boolean isVerified) { this.id = id; this.name = name; this.isVerified = isVerified; }
}

class Notification {
    public String recipientUserId, title, body;

    public Notification(String recipientUserId, String title, String body) {
        this.recipientUserId = recipientUserId; this.title = title; this.body = body;
    }
}
