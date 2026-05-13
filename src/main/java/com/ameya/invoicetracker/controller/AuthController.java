package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.dto.*;
import com.ameya.invoicetracker.service.impl.AuthAndUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthAndUserService authService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Login successful", authService.login(req)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserDTO>> getMe(@AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok(authService.getCurrentUser(ud.getUsername())));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<UserDTO>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.ok(authService.getAllUsers()));
    }

    @PostMapping("/users")
    public ResponseEntity<ApiResponse<UserDTO>> createUser(@Valid @RequestBody CreateUserRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("User created", authService.createUser(req)));
    }

    @PatchMapping("/users/{id}/toggle")
    public ResponseEntity<ApiResponse<UserDTO>> toggleUser(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(authService.toggleUserActive(id)));
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<ApiResponse<UserDTO>> updateUser(
            @PathVariable Long id,
            @RequestBody UpdateUserRequest req,
            @AuthenticationPrincipal UserDetails ud) {
        // Only ADMIN can update users
        return ResponseEntity.ok(ApiResponse.ok("User updated", authService.updateUser(id, req)));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<ApiResponse<UserDTO>> deleteUser(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("User disabled", authService.deleteUser(id)));
    }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest req,
            @AuthenticationPrincipal UserDetails ud) {
        authService.changePassword(ud.getUsername(), req);
        return ResponseEntity.ok(ApiResponse.ok("Password changed successfully", null));
    }
}
