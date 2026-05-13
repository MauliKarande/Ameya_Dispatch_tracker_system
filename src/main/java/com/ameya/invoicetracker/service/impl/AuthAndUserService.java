package com.ameya.invoicetracker.service.impl;

import com.ameya.invoicetracker.dto.*;
import com.ameya.invoicetracker.entity.User;
import com.ameya.invoicetracker.exception.*;
import com.ameya.invoicetracker.repository.UserRepository;
import com.ameya.invoicetracker.security.JwtUtils;import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class AuthAndUserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtils jwtUtils;

    public AuthResponse login(LoginRequest req) {
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword()));
        User user = userRepository.findByUsername(req.getUsername())
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!user.isActive()) throw new BadRequestException("Account is disabled.");
        String token = jwtUtils.generateTokenFromUsername(req.getUsername());
        return new AuthResponse(token, user.getUsername(), user.getFullName(), user.getRole().name(), "Login successful");
    }

    public UserDTO getCurrentUser(String username) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return toDTO(user);
    }

    public List<UserDTO> getAllUsers() {
        return userRepository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public UserDTO createUser(CreateUserRequest req) {
        if (userRepository.existsByUsername(req.getUsername()))
            throw new BadRequestException("Username already exists: " + req.getUsername());
        User.Role role = req.getRole();
        if (role == null) throw new BadRequestException("Role is required");
        User user = User.builder()
            .username(req.getUsername()).fullName(req.getFullName()).role(role)
            .password(passwordEncoder.encode(req.getPassword())).active(true).build();
        return toDTO(userRepository.save(user));
    }

    public UserDTO toggleUserActive(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
        user.setActive(!user.isActive());
        return toDTO(userRepository.save(user));
    }

    public UserDTO updateUser(Long id, UpdateUserRequest req) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));

        if (req.getFullName() != null && !req.getFullName().isBlank())
            user.setFullName(req.getFullName().trim());

        if (req.getUsername() != null && !req.getUsername().isBlank()) {
            String newUsername = req.getUsername().trim();
            if (!newUsername.equals(user.getUsername()) && userRepository.existsByUsername(newUsername))
                throw new BadRequestException("Username already taken: " + newUsername);
            user.setUsername(newUsername);
        }

        if (req.getNewPassword() != null && !req.getNewPassword().isBlank())
            user.setPassword(passwordEncoder.encode(req.getNewPassword()));

        if (req.getRole() != null)
            user.setRole(req.getRole());

        if (req.getActive() != null)
            user.setActive(req.getActive());

        return toDTO(userRepository.save(user));
    }

    public UserDTO deleteUser(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
        user.setActive(false);
        return toDTO(userRepository.save(user));
    }

    public void changePassword(String username, ChangePasswordRequest req) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!passwordEncoder.matches(req.getOldPassword(), user.getPassword()))
            throw new BadRequestException("Current password is incorrect.");
        if (!req.getNewPassword().equals(req.getConfirmPassword()))
            throw new BadRequestException("New passwords do not match.");
        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
    }

    private UserDTO toDTO(User u) {
        return UserDTO.builder().id(u.getId()).username(u.getUsername())
            .fullName(u.getFullName()).role(u.getRole().name()).active(u.isActive()).build();
    }
}
