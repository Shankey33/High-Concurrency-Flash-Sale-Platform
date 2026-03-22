package com.pm.common.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@Getter @Setter
public class StockSetDTO {
    @NotBlank
    private String productId;

    @Min(0)
    private int quantity;
}
