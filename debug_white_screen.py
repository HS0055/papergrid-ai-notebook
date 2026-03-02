from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("Listening for console logs and page errors...")
        
        # Capture console messages
        page.on("console", lambda msg: print(f"CONSOLE [{msg.type}]: {msg.text}"))
        
        # Capture unhandled page errors
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        
        # Capture failed network responses
        page.on("response", lambda response: print(f"RESPONSE [{response.status}]: {response.url}") if response.status >= 400 else None)

        try:
            print("Navigating to http://localhost:3000...")
            page.goto('http://localhost:3000')
            
            # Wait a bit for React to try and render
            page.wait_for_timeout(3000)
            
            print("Taking screenshot of the page...")
            page.screenshot(path="debug_screenshot.png")
            
        except Exception as e:
            print(f"Error navigating: {e}")
        finally:
            browser.close()
            print("Done.")

if __name__ == "__main__":
    main()
