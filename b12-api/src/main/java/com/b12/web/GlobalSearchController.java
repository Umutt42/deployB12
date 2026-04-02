package com.b12.web;

import com.b12.service.GlobalSearchService;
import com.b12.web.dto.SearchResultDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class GlobalSearchController {

    private final GlobalSearchService service;

    @GetMapping
    public List<SearchResultDto> search(@RequestParam(defaultValue = "") String q) {
        if (q.trim().length() < 2) return List.of();
        return service.search(q);
    }
}
