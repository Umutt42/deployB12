package com.b12.web.dto;

import com.b12.domain.User;

public final class UserMapper {

    private UserMapper() {
        // utilitaire
    }

    public static UserDtos.View toView(User user) {
        if (user == null) return null;

        UserDtos.View view = new UserDtos.View();
        view.setId(user.getId());
        view.setEmail(user.getEmail());
        view.setRole(user.getRole());
        view.setActive(user.isActive());
        view.setForcePasswordChange(user.isForcePasswordChange());
        view.setCreatedAt(user.getCreatedAt());
        return view;
    }
}
