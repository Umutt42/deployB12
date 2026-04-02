package com.b12.repository;

import com.b12.domain.Theme;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ThemeRepository extends JpaRepository<Theme, Long> {

    long countByArchivedFalse();

    Optional<Theme> findByLabelIgnoreCase(String label);

    @Query("""
        select distinct t
        from Theme t
        left join fetch t.subThemes
    """)
    List<Theme> findAllWithSubThemes();

    @Query("""
        select distinct t
        from Theme t
        left join fetch t.subThemes
        where t.id = :id
    """)
    Optional<Theme> findByIdWithSubThemes(@Param("id") Long id);
    @Query("""
    select distinct t
    from Theme t
    left join fetch t.subThemes
    where t.id in :ids
""")
List<Theme> findAllByIdWithSubThemes(@Param("ids") List<Long> ids);

}
