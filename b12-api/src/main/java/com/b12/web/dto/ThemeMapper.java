package com.b12.web.dto;

import com.b12.domain.SubTheme;
import com.b12.domain.Theme;

import java.util.List;

public final class ThemeMapper {

    private ThemeMapper() {}

    public static ThemeDtos toDto(Theme t) {
        if (t == null) return null;

        ThemeDtos dto = new ThemeDtos();
        dto.setId(t.getId());
        dto.setName(t.getLabel());              // label -> name
        dto.setDescription(t.getDescription());
        dto.setArchived(t.isArchived());

        // ✅ dates
        dto.setCreatedAt(t.getCreatedAt());
        dto.setUpdatedAt(t.getUpdatedAt());

        // ✅ audit
        dto.setUpdatedBy(t.getUpdatedBy());

        // subThemes
        if (t.getSubThemes() != null) {
            List<SubThemeDtos> subs = t.getSubThemes().stream()
                    .map(ThemeMapper::toDto)
                    .toList();
            dto.setSubThemes(subs);
        }

        return dto;
    }

    public static SubThemeDtos toDto(SubTheme st) {
        if (st == null) return null;

        SubThemeDtos dto = new SubThemeDtos();
        dto.setId(st.getId());
        dto.setName(st.getLabel());
        dto.setDescription(st.getDescription());
        dto.setHours(st.getHours());
        dto.setArchived(st.isArchived());

        if (st.getTheme() != null) {
            dto.setThemeId(st.getTheme().getId());
        }

        return dto;
    }
}
