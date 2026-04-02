package com.b12;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class B12ApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(B12ApiApplication.class, args);
	}

}
