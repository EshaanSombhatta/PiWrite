$body = @{
    student_id = "test-user"
    writing_id = "123"
    grade_level = "3"
    current_stage = "prewriting"
    student_text = "I want to write about a dragon"
    last_prompt = "initial"
    student_response = "I want to write about a dragon"
    retrieved_standards = @()
    instructional_gaps = @()
    messages = @()
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod "http://127.0.0.1:8003/api/agents/invoke" `
        -Method POST `
        -Headers @{ "Content-Type" = "application/json" } `
        -Body $body
    
    Write-Host "Response Received:"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error:" $_
    Write-Host "Status Code:" $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $reader.ReadToEnd()
    }
}
